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
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Stack,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td, ExpandableRowContent } from "@patternfly/react-table";
import { _ } from "~/i18n";
import Icon from "~/components/layout/Icon";
import { Disk } from "./types";
import DiskActionsMenu from "./DiskActionsMenu";
import PartitionActionsMenu from "./PartitionActionsMenu";

interface StorageDevicesTableProps {
  disks: Disk[];
  onOpenWizard: () => void;
  onAddDisk: () => void;
}

export default function StorageDevicesTable({
  disks,
  onOpenWizard,
  onAddDisk,
}: StorageDevicesTableProps): React.ReactElement {
  const [expandedDisks, setExpandedDisks] = useState<Set<string>>(new Set());

  const toggleExpanded = (diskName: string) => {
    setExpandedDisks((prev) => {
      const next = new Set(prev);
      if (next.has(diskName)) {
        next.delete(diskName);
      } else {
        next.add(diskName);
      }
      return next;
    });
  };

  if (disks.length === 0) {
    return (
      <EmptyState titleText={_("No disks configured")} icon={() => <Icon name="hard_drive" />}>
        <EmptyStateBody>
          {_("Configure storage to install the system.")}
          <br />
          {_("Use the guided setup wizard or manually add disks.")}
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={onOpenWizard}>
              {_("Guided Setup")}
            </Button>
          </EmptyStateActions>
          <EmptyStateActions>
            <Button variant="secondary" onClick={onAddDisk}>
              {_("Add Disk")}
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    );
  }

  return (
    <Stack hasGutter>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="secondary" onClick={onOpenWizard}>
              <Icon name="routine" /> {_("Guided Setup")}
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary" onClick={onAddDisk}>
              <Icon name="add" /> {_("Add Disk")}
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="link">
              <Icon name="visibility" /> {_("View Result")}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <Table variant="compact" aria-label={_("Selected Disks")}>
        <Thead>
          <Tr>
            <Th />
            <Th>{_("Name")}</Th>
            <Th>{_("Size")}</Th>
            <Th>{_("Description")}</Th>
            <Th />
          </Tr>
        </Thead>
        {disks.map((disk, diskIndex) => {
          const isExpanded = expandedDisks.has(disk.name);
          return (
            <Tbody key={disk.name} isExpanded={isExpanded}>
              <Tr>
                <Td
                  expand={{
                    rowIndex: diskIndex,
                    isExpanded,
                    onToggle: () => toggleExpanded(disk.name),
                  }}
                />
                <Td dataLabel={_("Name")}>{disk.name}</Td>
                <Td dataLabel={_("Size")}>{disk.size}</Td>
                <Td dataLabel={_("Description")}>{disk.description}</Td>
                <Td isActionCell>
                  <DiskActionsMenu disk={disk} />
                </Td>
              </Tr>
              <Tr isExpanded={isExpanded}>
                <Td colSpan={5}>
                  <ExpandableRowContent>
                    {disk.partitions.length > 0 ? (
                      <Table variant="compact" borders={false}>
                        <Thead>
                          <Tr>
                            <Th>{_("Partition")}</Th>
                            <Th>{_("Size")}</Th>
                            <Th>{_("Mount Point")}</Th>
                            <Th>{_("File System")}</Th>
                            <Th />
                          </Tr>
                        </Thead>
                        <Tbody>
                          {disk.partitions.map((partition) => (
                            <Tr
                              key={partition.name}
                              style={{
                                opacity: partition.deleted ? 0.6 : 1,
                              }}
                            >
                              <Td dataLabel={_("Partition")}>
                                {partition.deleted && (
                                  <>
                                    <Icon name="close" size="sm" />{" "}
                                  </>
                                )}
                                {partition.name}
                                {partition.deleted && (
                                  <>
                                    <br />
                                    <span style={{ fontSize: "0.875rem", fontStyle: "italic" }}>
                                      {"(deleted)"}
                                    </span>
                                  </>
                                )}
                                {partition.resize && (
                                  <>
                                    <br />
                                    <span style={{ fontSize: "0.875rem", fontStyle: "italic" }}>
                                      {"(resize)"}
                                    </span>
                                  </>
                                )}
                              </Td>
                              <Td dataLabel={_("Size")}>{partition.size}</Td>
                              <Td dataLabel={_("Mount Point")}>
                                {partition.deleted ? "-" : partition.mountPoint}
                              </Td>
                              <Td dataLabel={_("File System")}>{partition.filesystem}</Td>
                              <Td isActionCell>
                                <PartitionActionsMenu partition={partition} />
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    ) : (
                      <p>{_("No partitions")}</p>
                    )}
                  </ExpandableRowContent>
                </Td>
              </Tr>
            </Tbody>
          );
        })}
      </Table>
    </Stack>
  );
}
