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

export interface Partition {
  name: string;
  size: string;
  mountPoint?: string;
  filesystem: string;
  deleted?: boolean;
  resize?: boolean;
}

export interface Disk {
  name: string;
  size: string;
  description: string;
  partitions: Partition[];
}

export type PartitionAction = "delete" | "resize" | "keep";

export interface WizardResult {
  selectedDisk: string;
  partitionActions: Record<string, PartitionAction>;
  useLvm: boolean;
  useEncryption: boolean;
}
