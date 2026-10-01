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

import React from "react";
import { Stack } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { _ } from "~/i18n";
import { Disk } from "../types";

interface SelectDiskStepProps {
  disks: Disk[];
  selectedDisk: string | null;
  onSelectDisk: (diskName: string) => void;
}

export default function SelectDiskStep({
  disks,
  selectedDisk,
  onSelectDisk,
}: SelectDiskStepProps): React.ReactElement {
  return (
    <Stack hasGutter>
      <p>{_("Choose the disk where you want to install the system:")}</p>

      <Table variant="compact" aria-label={_("Available disks")}>
        <Thead>
          <Tr>
            <Th />
            <Th>{_("Name")}</Th>
            <Th>{_("Size")}</Th>
            <Th>{_("Description")}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {disks.map((disk) => (
            <Tr key={disk.name} isSelectable isClickable onRowClick={() => onSelectDisk(disk.name)}>
              <Td
                select={{
                  rowIndex: 0,
                  onSelect: () => onSelectDisk(disk.name),
                  isSelected: selectedDisk === disk.name,
                  variant: "radio",
                }}
              />
              <Td dataLabel={_("Name")}>{disk.name}</Td>
              <Td dataLabel={_("Size")}>{disk.size}</Td>
              <Td dataLabel={_("Description")}>{disk.description}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Stack>
  );
}
