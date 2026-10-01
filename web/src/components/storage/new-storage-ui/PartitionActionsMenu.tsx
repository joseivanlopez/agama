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
import { Dropdown, DropdownItem, DropdownList, MenuToggle } from "@patternfly/react-core";
import { EllipsisVIcon } from "@patternfly/react-icons";
import { _ } from "~/i18n";
import { Partition } from "./types";

interface PartitionActionsMenuProps {
  partition: Partition;
}

export default function PartitionActionsMenu({
  partition,
}: PartitionActionsMenuProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);

  if (partition.deleted) {
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
          <DropdownItem onClick={() => alert(`Restore ${partition.name}`)}>
            {_("Restore")}
          </DropdownItem>
        </DropdownList>
      </Dropdown>
    );
  }

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
        <DropdownItem onClick={() => alert(`Configure ${partition.name}`)}>
          {_("Configure")}
        </DropdownItem>
        <DropdownItem onClick={() => alert(`Delete ${partition.name}`)}>{_("Delete")}</DropdownItem>
      </DropdownList>
    </Dropdown>
  );
}
