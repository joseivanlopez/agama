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
import { Dropdown, DropdownItem, DropdownList, MenuToggle, Stack } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { EllipsisVIcon } from "@patternfly/react-icons";
import { _ } from "~/i18n";
import { Disk, Partition, PartitionAction } from "../types";
import Icon from "~/components/layout/Icon";

interface HandleContentStepProps {
  disk?: Disk;
  partitionActions: Record<string, PartitionAction>;
  onPartitionActionsChange: (actions: Record<string, PartitionAction>) => void;
}

interface PartitionActionMenuProps {
  partition: Partition;
  currentAction: PartitionAction;
  onActionChange: (action: PartitionAction) => void;
}

function PartitionActionMenu({
  // partition,
  // currentAction,
  onActionChange,
}: PartitionActionMenuProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          variant="plain"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={_("Actions")}
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem onClick={() => onActionChange("delete")}>{_("Delete")}</DropdownItem>
        <DropdownItem onClick={() => onActionChange("resize")}>{_("Resize")}</DropdownItem>
        <DropdownItem onClick={() => onActionChange("keep")}>{_("Keep")}</DropdownItem>
      </DropdownList>
    </Dropdown>
  );
}

export default function HandleContentStep({
  disk,
  partitionActions,
  onPartitionActionsChange,
}: HandleContentStepProps): React.ReactElement {
  if (!disk) {
    return <p>{_("Please select a disk first")}</p>;
  }

  const handleActionChange = (partitionName: string, action: PartitionAction) => {
    onPartitionActionsChange({
      ...partitionActions,
      [partitionName]: action,
    });
  };

  if (disk.partitions.length === 0) {
    return (
      <Stack hasGutter>
        <p>
          {_("Selected disk:")} {disk.name} ({disk.size})
        </p>
        <p>{_("This disk has no existing partitions.")}</p>
        <p>{_("All available space will be used for installation.")}</p>
      </Stack>
    );
  }

  return (
    <Stack hasGutter>
      <p>
        {_("Selected disk:")} {disk.name} ({disk.size})
      </p>
      <p>{_("This disk contains existing partitions. Choose what to do with each:")}</p>

      <Table variant="compact" aria-label={_("Existing partitions")}>
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
          {disk.partitions.map((partition) => {
            const action = partitionActions[partition.name] || "keep";
            const isDeleted = action === "delete";
            const isResize = action === "resize";

            return (
              <Tr
                key={partition.name}
                style={{
                  opacity: isDeleted ? 0.6 : 1,
                }}
              >
                <Td dataLabel={_("Partition")}>
                  {isDeleted && (
                    <>
                      <Icon name="close" size="sm" />{" "}
                    </>
                  )}
                  {partition.name}
                  {isDeleted && (
                    <>
                      <br />
                      <span style={{ fontSize: "0.875rem", fontStyle: "italic" }}>
                        {"(deleted)"}
                      </span>
                    </>
                  )}
                  {isResize && (
                    <>
                      <br />
                      <span style={{ fontSize: "0.875rem", fontStyle: "italic" }}>
                        {"(resize)"}
                      </span>
                    </>
                  )}
                </Td>
                <Td dataLabel={_("Size")}>{partition.size}</Td>
                <Td dataLabel={_("Mount Point")}>{isDeleted ? "-" : partition.mountPoint}</Td>
                <Td dataLabel={_("File System")}>{partition.filesystem}</Td>
                <Td isActionCell>
                  <PartitionActionMenu
                    partition={partition}
                    currentAction={action}
                    onActionChange={(newAction) => handleActionChange(partition.name, newAction)}
                  />
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Stack>
  );
}
