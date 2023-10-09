# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require_relative "../../test_helper"
require_relative "../with_issues_examples"
require_relative "../with_progress_examples"
require_relative File.join(
  SRC_PATH, "agama", "dbus", "y2dir", "software", "modules", "PackageCallbacks.rb"
)
require "agama/config"
require "agama/issue"
require "agama/software/manager"
require "agama/software/proposal"
require "agama/dbus/clients/questions"

describe Agama::Software::Manager do
  subject { described_class.new(config, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:base_url) { "" }
  let(:destdir) { "/mnt" }
  let(:gpg_keys) { [] }

  let(:repositories) do
    instance_double(
      Agama::Software::RepositoriesManager,
      add:        nil,
      load:       nil,
      delete_all: nil,
      empty?:     true,
      enabled:    enabled_repos,
      disabled:   disabled_repos
    )
  end

  let(:proposal) do
    instance_double(
      Agama::Software::Proposal,
      :base_product= => nil,
      calculate:        nil,
      :languages= =>    nil,
      set_resolvables:  nil,
      packages_count:   "500 MB",
      issues:           proposal_issues
    )
  end

  let(:enabled_repos) { [] }
  let(:disabled_repos) { [] }
  let(:proposal_issues) { [] }

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end

  let(:config) do
    Agama::Config.new(YAML.safe_load(File.read(config_path)))
  end

  let(:questions_client) do
    instance_double(Agama::DBus::Clients::Questions)
  end

  before do
    allow(Yast::Pkg).to receive(:TargetInitialize)
    allow(Yast::Pkg).to receive(:ImportGPGKey)
    allow(Dir).to receive(:glob).with(/keys/).and_return(gpg_keys)
    allow(Yast::Packages).to receive(:Proposal).and_return({})
    allow(Yast::InstURL).to receive(:installInf2Url).with("")
      .and_return(base_url)
    allow(Yast::Pkg).to receive(:SourceCreate)
    allow(Yast::Installation).to receive(:destdir).and_return(destdir)
    allow(Agama::DBus::Clients::Questions).to receive(:new).and_return(questions_client)
    allow(Agama::Software::RepositoriesManager).to receive(:new).and_return(repositories)
    allow(Agama::Software::Proposal).to receive(:new).and_return(proposal)
  end

  shared_examples "software issues" do |tested_method|
    before do
      allow(subject).to receive(:product).and_return("Tumbleweed")
    end

    let(:proposal_issues) { [Agama::Issue.new("Proposal issue")] }

    context "if there is no product selected yet" do
      before do
        allow(subject).to receive(:product).and_return(nil)
      end

      it "sets an issue" do
        subject.public_send(tested_method)

        expect(subject.issues).to contain_exactly(an_object_having_attributes(
          description: /product not selected/i
        ))
      end
    end

    context "if there are disabled repositories" do
      let(:disabled_repos) do
        [
          instance_double(Agama::Software::Repository, name: "Repo #1"),
          instance_double(Agama::Software::Repository, name: "Repo #2")
        ]
      end

      it "adds an issue for each disabled repository" do
        subject.public_send(tested_method)

        expect(subject.issues).to include(
          an_object_having_attributes(
            description: /could not read the repository Repo #1/i
          ),
          an_object_having_attributes(
            description: /could not read the repository Repo #2/i
          )
        )
      end
    end

    context "if there is any enabled repository" do
      let(:enabled_repos) { [instance_double(Agama::Software::Repository, name: "Repo #1")] }

      it "adds the proposal issues" do
        subject.public_send(tested_method)

        expect(subject.issues).to include(an_object_having_attributes(
          description: /proposal issue/i
        ))
      end
    end

    context "if there is no enabled repository" do
      let(:enabled_repos) { [] }

      it "does not add the proposal issues" do
        subject.public_send(tested_method)

        expect(subject.issues).to_not include(an_object_having_attributes(
          description: /proposal issue/i
        ))
      end
    end
  end

  describe "#probe" do
    let(:rootdir) { Dir.mktmpdir }
    let(:repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d") }
    let(:backup_repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d.backup") }

    before do
      stub_const("Agama::Software::Manager::REPOS_DIR", repos_dir)
      stub_const("Agama::Software::Manager::REPOS_BACKUP", backup_repos_dir)
      FileUtils.mkdir_p(repos_dir)
    end

    after do
      FileUtils.remove_entry(rootdir)
    end

    it "initializes the package system" do
      expect(Yast::Pkg).to receive(:TargetInitialize).with("/")
      subject.probe
    end

    context "when GPG keys are available at /" do
      let(:gpg_keys) { ["/usr/lib/gnupg/keys/gpg-key.asc"] }

      it "imports the GPG keys" do
        expect(Yast::Pkg).to receive(:ImportGPGKey).with(gpg_keys.first, true)
        subject.probe
      end
    end

    it "creates a packages proposal" do
      expect(proposal).to receive(:calculate)
      subject.probe
    end

    it "registers the repository from config" do
      expect(repositories).to receive(:add).with(/tumbleweed/)
      expect(repositories).to receive(:load)
      subject.probe
    end

    include_examples "software issues", "probe"
  end

  describe "#products" do
    it "returns the list of known products" do
      products = subject.products
      expect(products.size).to eq(3)
      id, data = products.first
      expect(id).to eq("Tumbleweed")
      expect(data).to include(
        "name"        => "openSUSE Tumbleweed",
        "description" => String
      )
    end
  end

  describe "#propose" do
    before do
      subject.select_product("Tumbleweed")
      allow(Yast::Arch).to receive(:s390).and_return(false)
    end

    it "creates a new proposal for the selected product" do
      expect(proposal).to receive(:languages=).with(["en_US"])
      expect(proposal).to receive(:base_product=).with("openSUSE")
      expect(proposal).to receive(:calculate)
      subject.propose
    end

    it "adds the patterns and packages to install depending on the system architecture" do
      expect(proposal).to receive(:set_resolvables)
        .with("agama", :pattern, ["enhanced_base"])
      expect(proposal).to receive(:set_resolvables)
        .with("agama", :pattern, ["optional_base"], optional: true)
      expect(proposal).to receive(:set_resolvables)
        .with("agama", :package, ["mandatory_pkg"])
      expect(proposal).to receive(:set_resolvables)
        .with("agama", :package, ["optional_pkg"], optional: true)
      subject.propose

      expect(Yast::Arch).to receive(:s390).and_return(true)
      expect(proposal).to receive(:set_resolvables)
        .with("agama", :package, ["mandatory_pkg", "mandatory_pkg_s390"])
      subject.propose
    end

    include_examples "software issues", "propose"
  end

  describe "#install" do
    let(:commit_result) { [250, [], [], [], []] }

    before do
      allow(Yast::Pkg).to receive(:Commit).and_return(commit_result)
    end

    it "installs the packages" do
      expect(Yast::Pkg).to receive(:Commit).with({})
        .and_return(commit_result)
      subject.install
    end

    it "sets up the package callbacks" do
      expect(Agama::Software::Callbacks::Progress).to receive(:setup)
      subject.install
    end

    context "when packages installation fails" do
      let(:commit_result) { nil }

      it "raises an exception" do
        expect { subject.install }.to raise_error(RuntimeError)
      end
    end
  end

  describe "#finish" do
    let(:rootdir) { Dir.mktmpdir }
    let(:repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d") }
    let(:backup_repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d.backup") }

    before do
      stub_const("Agama::Software::Manager::REPOS_DIR", repos_dir)
      stub_const("Agama::Software::Manager::REPOS_BACKUP", backup_repos_dir)
      FileUtils.mkdir_p(repos_dir)
      FileUtils.mkdir_p(backup_repos_dir)
      FileUtils.touch(File.join(backup_repos_dir, "example.repo"))
      puts Dir[File.join(repos_dir, "**", "*")]
    end

    after do
      FileUtils.remove_entry(rootdir)
    end

    it "releases the packaging system and restores the backup" do
      expect(Yast::Pkg).to receive(:SourceSaveAll)
      expect(Yast::Pkg).to receive(:TargetFinish)
      expect(Yast::Pkg).to receive(:SourceCacheCopyTo)
        .with(Yast::Installation.destdir)

      subject.finish
      expect(File).to exist(File.join(repos_dir, "example.repo"))
    end
  end

  describe "#package_installed?" do
    before do
      allow(Yast::Package).to receive(:Installed).with(package, target: :system)
        .and_return(installed?)
    end

    let(:package) { "NetworkManager" }

    context "when the package is installed" do
      let(:installed?) { true }

      it "returns true" do
        expect(subject.package_installed?(package)).to eq(true)
      end
    end

    context "when the package is not installed" do
      let(:installed?) { false }

      it "returns false" do
        expect(subject.package_installed?(package)).to eq(false)
      end
    end
  end

  include_examples "issues"
  include_examples "progress"
end
