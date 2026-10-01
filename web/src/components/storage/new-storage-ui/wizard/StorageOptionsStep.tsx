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
import { Checkbox, Stack } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { Disk } from "../types";

interface StorageOptionsStepProps {
  disk?: Disk;
  useLvm: boolean;
  useEncryption: boolean;
  onUseLvmChange: (value: boolean) => void;
  onUseEncryptionChange: (value: boolean) => void;
}

export default function StorageOptionsStep({
  disk,
  useLvm,
  useEncryption,
  onUseLvmChange,
  onUseEncryptionChange,
}: StorageOptionsStepProps): React.ReactElement {
  if (!disk) {
    return <p>{_("Please select a disk first")}</p>;
  }

  return (
    <Stack hasGutter>
      <p>
        {_("Selected disk:")} {disk.name} ({disk.size})
      </p>
      <p>{_("Configure additional storage options:")}</p>

      <Stack hasGutter>
        <Checkbox
          label={_("Use LVM (Logical Volume Manager)")}
          description={_("Allows flexible partition management and resizing")}
          isChecked={useLvm}
          onChange={(_, checked) => onUseLvmChange(checked)}
          id="use-lvm"
        />

        <Checkbox
          label={_("Enable encryption")}
          description={_("Encrypts data to protect against unauthorized access")}
          isChecked={useEncryption}
          onChange={(_, checked) => onUseEncryptionChange(checked)}
          id="use-encryption"
        />
      </Stack>
    </Stack>
  );
}
