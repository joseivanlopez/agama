/*
 * Copyright (c) [2024-2026] SUSE LLC
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

import React, { useState } from "react";
import { Stack } from "@patternfly/react-core";
import Page from "~/components/layout/Page";
import { _ } from "~/i18n";
import StorageDevicesTable from "./new-storage-ui/StorageDevicesTable";
import GuidedStorageWizard from "./new-storage-ui/GuidedStorageWizard";
import { Disk, WizardResult } from "./new-storage-ui/types";
import { FAKE_DISKS } from "./new-storage-ui/fakeData";

export default function NewStoragePage(): React.ReactElement {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedDisks, setSelectedDisks] = useState<Disk[]>([]);

  const handleWizardComplete = (result: WizardResult) => {
    const disk = FAKE_DISKS.find((d) => d.name === result.selectedDisk);
    if (!disk) return;

    // Apply wizard results to the disk
    const updatedDisk: Disk = {
      ...disk,
      partitions: disk.partitions.map((p) => {
        const action = result.partitionActions[p.name];
        if (action === "delete") {
          return { ...p, deleted: true, mountPoint: undefined };
        } else if (action === "resize") {
          return { ...p, resize: true, size: "200 GB" };
        }
        return p;
      }),
    };

    // Add new partitions created by wizard
    if (result.useLvm || result.useEncryption) {
      const options = [];
      if (result.useLvm) options.push("LVM");
      if (result.useEncryption) options.push("encr.");
      const optionsStr = options.length > 0 ? ` (${options.join(", ")})` : "";

      updatedDisk.partitions = [
        ...updatedDisk.partitions,
        {
          name: "New",
          size: "100 GB",
          mountPoint: "/",
          filesystem: `ext4${optionsStr}`,
        },
        {
          name: "New",
          size: "99.5 GB",
          mountPoint: "swap",
          filesystem: `swap${optionsStr}`,
        },
      ];
    }

    setSelectedDisks([updatedDisk]);
    setIsWizardOpen(false);
  };

  return (
    <Page breadcrumbs={[{ label: _("Storage") }]}>
      <Page.Content>
        <Stack hasGutter>
          <StorageDevicesTable
            disks={selectedDisks}
            onOpenWizard={() => setIsWizardOpen(true)}
            onAddDisk={() => {
              // Mock: Just add the first disk
              if (selectedDisks.length === 0) {
                setSelectedDisks([FAKE_DISKS[0]]);
              }
            }}
          />
        </Stack>
      </Page.Content>

      {isWizardOpen && (
        <GuidedStorageWizard
          disks={FAKE_DISKS}
          onClose={() => setIsWizardOpen(false)}
          onComplete={handleWizardComplete}
        />
      )}
    </Page>
  );
}
