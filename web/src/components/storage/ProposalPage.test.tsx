/*
 * Copyright (c) [2022-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ProposalPage from "./ProposalPage";
import { useAvailableDevices } from "~/hooks/api/system/storage";
import { useIssues } from "~/hooks/api/issue";
import { useProposal } from "~/hooks/api/proposal/storage";
import { useStorageModel } from "~/hooks/api/storage";
import { useProgress } from "~/queries/progress";
import { useLocation } from "react-router";
import { useStorageUiState } from "~/context/storage-ui-state";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";
import { useReset } from "~/hooks/api/config/storage";
import { useSystem } from "~/hooks/api/system";
import { useProduct } from "~/hooks/api/config";

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const render = (ui: React.ReactElement) =>
  rtlRender(
    <QueryClientProvider client={testQueryClient}>
      <React.Suspense fallback={<p>loading</p>}>{ui}</React.Suspense>
    </QueryClientProvider>,
  );

// Mocking hooks
jest.mock("~/hooks/api/system/storage");
jest.mock("~/hooks/api/issue");
jest.mock("~/hooks/api/config/storage");
jest.mock("~/hooks/api/proposal/storage");
jest.mock("~/hooks/api/storage");
jest.mock("~/hooks/api/system");
jest.mock("~/hooks/api/config");
jest.mock("~/queries/storage/zfcp");
jest.mock("~/queries/storage/dasd");
jest.mock("~/queries/progress");

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useLocation: jest.fn(),
}));

const mockSetUiState = jest.fn();
jest.mock("~/context/storage-ui-state");

// Mocking child components to simplify testing
jest.mock("./ConfigEditor", () => () => <div>ConfigEditor</div>);
jest.mock("./ConnectedDevicesMenu", () => () => <div>ConnectedDevicesMenu</div>);
jest.mock("./EncryptionSection", () => () => <div>EncryptionSection</div>);
jest.mock("./BootSection", () => () => <div>BootSection</div>);
jest.mock("./FixableConfigInfo", () => () => <div>FixableConfigInfo</div>);
jest.mock("./ProposalFailedInfo", () => () => <div>ProposalFailedInfo</div>);
jest.mock("./ProposalResultSection", () => () => <div>ProposalResultSection</div>);
jest.mock("./ProposalTransactionalInfo", () => () => <div>ProposalTransactionalInfo</div>);
jest.mock("./UnsupportedModelInfo", () => () => <div>UnsupportedModelInfo</div>);

// Mock i18n
jest.mock("~/i18n", () => ({
  _: (str: string) => str,
  n_: (str: string) => str,
  N_: (str: string) => str,
}));

// Mock react-router Link
jest.mock("~/components/core/Link", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children }: any) => <a>{children}</a>;
});

const useAvailableDevicesMock = useAvailableDevices as jest.Mock;
const useIssuesMock = useIssues as jest.Mock;
const useProposalMock = useProposal as jest.Mock;
const useStorageModelMock = useStorageModel as jest.Mock;
const useProgressMock = useProgress as jest.Mock;
const useLocationMock = useLocation as jest.Mock;
const useStorageUiStateMock = useStorageUiState as jest.Mock;
const useZFCPSupportedMock = useZFCPSupported as jest.Mock;
const useDASDSupportedMock = useDASDSupported as jest.Mock;
const useResetMock = useReset as jest.Mock;
const useSystemMock = useSystem as jest.Mock;
const useProductMock = useProduct as jest.Mock;

describe("ProposalPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationMock.mockReturnValue({ pathname: "/", state: null });
    useProgressMock.mockReturnValue(null);
    useAvailableDevicesMock.mockReturnValue([{}]);
    useIssuesMock.mockReturnValue([]);
    useStorageModelMock.mockReturnValue({});
    useProposalMock.mockReturnValue({});
    useStorageUiStateMock.mockReturnValue({
      uiState: new Map(),
      setUiState: mockSetUiState,
    });
    useResetMock.mockReturnValue(jest.fn());
    useSystemMock.mockReturnValue(null);
    useProductMock.mockReturnValue(null);
  });

  it("navigates to progress page if installation is in progress", () => {
    useProgressMock.mockReturnValue({ finished: false });
    render(<ProposalPage />);
    expect(mockNavigate).toHaveBeenCalledWith("/storage/progress");
  });

  it("does not navigate if installation is finished", () => {
    useProgressMock.mockReturnValue({ finished: true });
    render(<ProposalPage />);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("Storage")).toBeInTheDocument();
  });

  it("resets UI state when required and then renders content", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/",
      state: { resetStorageUiState: true },
    });

    render(<ProposalPage />);

    // The useEffect should trigger a re-render. We wait for the content to appear.
    expect(await screen.findByText("Storage")).toBeInTheDocument();

    // Check if the state was reset
    expect(mockSetUiState).toHaveBeenCalledWith(new Map());
  });

  describe("ProposalPageContent", () => {
    it("shows UnavailableDevicesEmptyState when no devices are available", async () => {
      useAvailableDevicesMock.mockReturnValue([]);
      render(<ProposalPage />);
      expect(await screen.findByText("No devices found")).toBeInTheDocument();
    });

    it("shows InvalidConfigEmptyState for unfixable issues", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      const issues = [{ class: "some-unfixable-issue", description: "foo" }];
      useIssuesMock.mockReturnValue(issues);
      useStorageModelMock.mockReturnValue({}); // isModelEditable will be false

      render(<ProposalPage />);
      expect(await screen.findByText("Invalid storage settings")).toBeInTheDocument();
      expect(screen.getByText("foo")).toBeInTheDocument();
    });

    it("shows UnknownConfigEmptyState for unknown configuration", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      useIssuesMock.mockReturnValue([]);
      useStorageModelMock.mockReturnValue(null);
      useProposalMock.mockReturnValue(null);

      render(<ProposalPage />);
      expect(await screen.findByText("Unable to modify the settings")).toBeInTheDocument();
    });

    it("shows FixableConfigInfo for fixable issues", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      const issues = [{ class: "configNoRoot", description: "bar" }];
      useIssuesMock.mockReturnValue(issues);
      useStorageModelMock.mockReturnValue({}); // isModelEditable will be true
      useProposalMock.mockReturnValue({});

      render(<ProposalPage />);
      expect(await screen.findByText("FixableConfigInfo")).toBeInTheDocument();
    });

    it("shows ProposalFailedInfo when there is no proposal", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      useIssuesMock.mockReturnValue([]);
      useStorageModelMock.mockReturnValue({});
      useProposalMock.mockReturnValue(null);

      render(<ProposalPage />);
      expect(await screen.findByText("ProposalFailedInfo")).toBeInTheDocument();
    });

    it("shows UnsupportedModelInfo when there is no model", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      useIssuesMock.mockReturnValue([]);
      useStorageModelMock.mockReturnValue(null);
      useProposalMock.mockReturnValue({});

      render(<ProposalPage />);
      expect(await screen.findByText("UnsupportedModelInfo")).toBeInTheDocument();
    });

    it("shows ModelSection when model is available", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      useIssuesMock.mockReturnValue([]);
      useStorageModelMock.mockReturnValue({});
      useProposalMock.mockReturnValue({});

      render(<ProposalPage />);
      expect(await screen.findByText("Settings")).toBeInTheDocument();
      expect(await screen.findByText("ConfigEditor")).toBeInTheDocument();
    });

    it("shows ProposalResultSection when proposal is available", async () => {
      useAvailableDevicesMock.mockReturnValue([{}]);
      useIssuesMock.mockReturnValue([]);
      useStorageModelMock.mockReturnValue({});
      useProposalMock.mockReturnValue({});

      render(<ProposalPage />);
      expect(await screen.findByText("ProposalResultSection")).toBeInTheDocument();
    });
  });

  describe("UnavailableDevicesEmptyState", () => {
    beforeEach(() => {
      useAvailableDevicesMock.mockReturnValue([]);
    });

    it("renders basic message", async () => {
      useZFCPSupportedMock.mockReturnValue(false);
      useDASDSupportedMock.mockReturnValue(false);
      render(<ProposalPage />);
      expect(await screen.findByText("No devices found")).toBeInTheDocument();
      expect(screen.getByText("Connect to iSCSI targets")).toBeInTheDocument();
      expect(screen.queryByText("Activate zFCP disks")).not.toBeInTheDocument();
      expect(screen.queryByText("Manage DASD devices")).not.toBeInTheDocument();
    });

    it("renders zFCP link when supported", async () => {
      useZFCPSupportedMock.mockReturnValue(true);
      useDASDSupportedMock.mockReturnValue(false);
      render(<ProposalPage />);
      expect(await screen.findByText("Activate zFCP disks")).toBeInTheDocument();
      expect(screen.queryByText("Manage DASD devices")).not.toBeInTheDocument();
    });

    it("renders DASD link when supported", async () => {
      useZFCPSupportedMock.mockReturnValue(false);
      useDASDSupportedMock.mockReturnValue(true);
      render(<ProposalPage />);
      expect(await screen.findByText("Manage DASD devices")).toBeInTheDocument();
      expect(screen.queryByText("Activate zFCP disks")).not.toBeInTheDocument();
    });
  });

  describe("ModelSection", () => {
    it("allows tab switching", async () => {
      const setUiState = jest.fn();
      useStorageUiStateMock.mockReturnValue({
        uiState: new Map(),
        setUiState,
      });
      useAvailableDevicesMock.mockReturnValue([{}]);
      useIssuesMock.mockReturnValue([]);
      useStorageModelMock.mockReturnValue({});
      useProposalMock.mockReturnValue({});

      render(<ProposalPage />);
      expect(await screen.findByText("Settings")).toBeInTheDocument();

      const encryptionTab = screen.getByText("Encryption");
      fireEvent.click(encryptionTab);

      expect(setUiState).toHaveBeenCalledTimes(1);
      const callback = setUiState.mock.calls[0][0];
      const newState = callback(new Map());
      expect(newState.get("st")).toBe("1");
    });
  });
});
