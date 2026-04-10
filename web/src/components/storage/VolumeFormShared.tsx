/*
 * Copyright (c) [2025-2026] SUSE LLC
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

/**
 * Shared components, hooks, and utilities for PartitionPage and LogicalVolumePage
 */

import React from "react";
import {
  Divider,
  Label,
  SelectGroup,
  SelectList,
  SelectOption,
  SelectOptionProps,
  Split,
  SplitItem,
  TextInput,
} from "@patternfly/react-core";
import { SelectWrapper as Select, SubtleContent } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import AutoSizeText from "~/components/storage/AutoSizeText";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { useConfigModel, useMissingMountPaths } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { deviceSize, filesystemLabel, parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { compact } from "~/utils";
import { unique } from "radashi";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

// ============================================================================
// Constants
// ============================================================================

export const NO_VALUE = "";
export const REUSE_FILESYSTEM = "reuse";

// ============================================================================
// Types
// ============================================================================

export type SizeOptionValue = "" | "auto" | "custom";
export type { SizeMode, SizeRange } from "~/components/storage/SizeModeSelect";

export type BaseFormValue = {
  mountPoint: string;
  filesystem: string;
  filesystemLabel: string;
  sizeOption: SizeOptionValue;
  minSize: string;
  maxSize: string;
};

export type Error = {
  id: string;
  message?: string;
  isVisible: boolean;
};

export type ErrorsHandler = {
  errors: Error[];
  getError: (id: string) => Error | undefined;
  getVisibleError: (id: string) => Error | undefined;
};

// ============================================================================
// Validation Hooks
// ============================================================================

export function useMountPointError(
  mountPoint: string,
  initialMountPoint?: string,
): Error | undefined {
  const config = useConfigModel();
  const mountPoints = config ? configModel.usedMountPaths(config) : [];

  if (mountPoint === NO_VALUE) {
    return {
      id: "mountPoint",
      isVisible: false,
    };
  }

  const regex = /^swap$|^\/$|^(\/[^/\s]+)+$/;
  if (!regex.test(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a valid mount point"),
      isVisible: true,
    };
  }

  // Exclude itself when editing
  if (mountPoint !== initialMountPoint && mountPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

export function useSizeError(
  sizeOption: SizeOptionValue,
  minSize: string,
  maxSize: string,
): Error | undefined {
  if (sizeOption !== "custom") return;

  if (!minSize) {
    return {
      id: "customSize",
      isVisible: false,
    };
  }

  const regexp = /^[0-9]+(\.[0-9]+)?(\s*([KkMmGgTtPpEeZzYy][iI]?)?[Bb])$/;
  const validMin = regexp.test(minSize);
  const validMax = maxSize ? regexp.test(maxSize) : true;

  if (validMin && validMax) {
    if (!maxSize || parseToBytes(minSize) <= parseToBytes(maxSize)) return;

    return {
      id: "customSize",
      message: _("The minimum cannot be greater than the maximum"),
      isVisible: true,
    };
  }

  if (validMin) {
    return {
      id: "customSize",
      message: _("The maximum must be a number followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  if (validMax) {
    return {
      id: "customSize",
      message: _("The minimum must be a number followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  return {
    id: "customSize",
    message: _("Size limits must be numbers followed by a unit like GiB or GB"),
    isVisible: true,
  };
}

export function useErrorsHandler(errors: Error[]): ErrorsHandler {
  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

// ============================================================================
// Filesystem Hooks
// ============================================================================

export function useDefaultFilesystem(mountPoint: string): string {
  const volume = useVolumeTemplate(mountPoint);
  return volume.fsType;
}

export function useUsableFilesystems(mountPoint: string): string[] {
  const volume = useVolumeTemplate(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);

  const usableFilesystems = React.useMemo(() => {
    const volumeFilesystems = (): string[] => {
      return volume.outline.fsTypes;
    };

    return unique([defaultFilesystem, ...volumeFilesystems()]);
  }, [volume, defaultFilesystem]);

  return usableFilesystems;
}

export function useUnusedMountPoints(initialMountPoint?: string): string[] {
  const unusedMountPaths = useMissingMountPaths();
  return compact([initialMountPoint, ...unusedMountPaths]);
}

// ============================================================================
// Auto-refresh Hooks
// ============================================================================

type AutoRefreshFilesystemParams = {
  mountPoint: string;
  target: string;
  newTargetValue: string;
  defaultFilesystem: string;
  usableFilesystems: string[];
  targetFilesystem: string | null;
};

export function useAutoRefreshFilesystem(
  handler: (filesystem: string) => void,
  params: AutoRefreshFilesystemParams,
) {
  const {
    mountPoint,
    target,
    newTargetValue,
    defaultFilesystem,
    usableFilesystems,
    targetFilesystem,
  } = params;

  React.useEffect(() => {
    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) handler(NO_VALUE);
    // Select default filesystem for the mount point.
    if (mountPoint !== NO_VALUE && target === newTargetValue) handler(defaultFilesystem);
    // Select default filesystem for the mount point if the target has no filesystem.
    if (mountPoint !== NO_VALUE && target !== newTargetValue && !targetFilesystem)
      handler(defaultFilesystem);
    // Reuse the filesystem from the target if possible.
    if (mountPoint !== NO_VALUE && target !== newTargetValue && targetFilesystem) {
      const reuse = usableFilesystems.includes(targetFilesystem);
      handler(reuse ? REUSE_FILESYSTEM : defaultFilesystem);
    }
  }, [
    handler,
    mountPoint,
    target,
    newTargetValue,
    defaultFilesystem,
    usableFilesystems,
    targetFilesystem,
  ]);
}

type AutoRefreshSizeParams = {
  target: string;
  newTargetValue: string;
  solvedMinSize: string;
  solvedMaxSize: string;
};

export function useAutoRefreshSize(
  handler: (sizeOption: SizeOptionValue, minSize: string, maxSize: string) => void,
  params: AutoRefreshSizeParams,
) {
  const { target, newTargetValue, solvedMinSize, solvedMaxSize } = params;

  React.useEffect(() => {
    const sizeOption = target === newTargetValue ? "auto" : "";
    handler(sizeOption, solvedMinSize, solvedMaxSize);
  }, [handler, target, newTargetValue, solvedMinSize, solvedMaxSize]);
}

// ============================================================================
// Helper Functions
// ============================================================================

export function mountPointSelectOptions(mountPoints: string[]): SelectOptionProps[] {
  return mountPoints.map((p) => ({ value: p, children: p }));
}

export function sizeToString(value: number | undefined): string {
  return value ? deviceSize(value, { exact: true }) : NO_VALUE;
}

// ============================================================================
// Shared Components
// ============================================================================

type DeviceDescriptionProps = {
  device: System.Device;
};

export function DeviceDescription({ device }: DeviceDescriptionProps): React.ReactNode {
  const label = device.filesystem?.label;

  return (
    <Split hasGutter>
      <SplitItem>{device.description}</SplitItem>
      {label && (
        <SplitItem>
          <Label isCompact variant="outline">
            {label}
          </Label>
        </SplitItem>
      )}
    </Split>
  );
}

type FilesystemOptionLabelProps = {
  value: string;
  targetFilesystem: string | null;
};

export function FilesystemOptionLabel({
  value,
  targetFilesystem,
}: FilesystemOptionLabelProps): React.ReactNode {
  if (value === NO_VALUE) return _("Waiting for a mount point");
  // TRANSLATORS: %s is a filesystem type, like Btrfs
  if (value === REUSE_FILESYSTEM && targetFilesystem)
    return sprintf(_("Current %s"), filesystemLabel(targetFilesystem));

  return filesystemLabel(value);
}

type FilesystemOptionsProps = {
  mountPoint: string;
  target: string;
  defaultFilesystem: string;
  usableFilesystems: string[];
  targetFilesystem: string | null;
  defaultOptText: string;
  formatTextWithData: string;
  formatTextWithoutData: string;
};

export function FilesystemOptions({
  mountPoint,
  target,
  defaultFilesystem,
  usableFilesystems,
  targetFilesystem,
  defaultOptText,
  formatTextWithData,
  formatTextWithoutData,
}: FilesystemOptionsProps): React.ReactNode {
  const canReuse = targetFilesystem && usableFilesystems.includes(targetFilesystem);
  const formatText = targetFilesystem ? formatTextWithData : formatTextWithoutData;

  return (
    <SelectList aria-label="Available file systems">
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} targetFilesystem={targetFilesystem} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canReuse && (
        <SelectOption
          value={REUSE_FILESYSTEM}
          description={sprintf(_("Do not format %s and keep the data"), target)}
        >
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} targetFilesystem={targetFilesystem} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canReuse && usableFilesystems.length > 0 && <Divider />}
      {mountPoint !== NO_VALUE && (
        <SelectGroup label={formatText}>
          {usableFilesystems.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={fsType === defaultFilesystem ? defaultOptText : undefined}
            >
              <FilesystemOptionLabel value={fsType} targetFilesystem={targetFilesystem} />
            </SelectOption>
          ))}
        </SelectGroup>
      )}
    </SelectList>
  );
}

type FilesystemSelectProps = {
  id?: string;
  value: string;
  mountPoint: string;
  target: string;
  targetFilesystem: string | null;
  defaultFilesystem: string;
  usableFilesystems: string[];
  defaultOptText: string;
  formatTextWithData: string;
  formatTextWithoutData: string;
  onChange: SelectProps["onChange"];
};

export function FilesystemSelect({
  id,
  value,
  mountPoint,
  target,
  targetFilesystem,
  defaultFilesystem,
  usableFilesystems,
  defaultOptText,
  formatTextWithData,
  formatTextWithoutData,
  onChange,
}: FilesystemSelectProps): React.ReactNode {
  const usedValue = mountPoint === NO_VALUE ? NO_VALUE : value;

  return (
    <Select
      id={id}
      value={usedValue}
      label={<FilesystemOptionLabel value={usedValue} targetFilesystem={targetFilesystem} />}
      onChange={onChange}
      isDisabled={mountPoint === NO_VALUE}
    >
      <FilesystemOptions
        mountPoint={mountPoint}
        target={target}
        defaultFilesystem={defaultFilesystem}
        usableFilesystems={usableFilesystems}
        targetFilesystem={targetFilesystem}
        defaultOptText={defaultOptText}
        formatTextWithData={formatTextWithData}
        formatTextWithoutData={formatTextWithoutData}
      />
    </Select>
  );
}

type FilesystemLabelProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
};

export function FilesystemLabel({ id, value, onChange }: FilesystemLabelProps): React.ReactNode {
  const isValid = (v: string) => /^[\w-_.]*$/.test(v);

  return (
    <TextInput
      id={id}
      aria-label={_("File system label")}
      value={value}
      onChange={(_, v) => isValid(v) && onChange(v)}
    />
  );
}

type AutoSizeInfoProps = {
  mountPoint: string;
  size: ConfigModel.Size | undefined;
  deviceType: "partition" | "logicalVolume";
};

export function AutoSizeInfo({ mountPoint, size, deviceType }: AutoSizeInfoProps): React.ReactNode {
  const volume = useVolumeTemplate(mountPoint);

  if (!size) return null;

  return (
    <SubtleContent>
      <AutoSizeText volume={volume} size={size} deviceType={deviceType} />
    </SubtleContent>
  );
}
