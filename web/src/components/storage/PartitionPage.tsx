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

import React from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  ActionGroup,
  Divider,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  SelectGroup,
  SelectList,
  SelectOption,
  Stack,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import SizeModeSelect from "~/components/storage/SizeModeSelect";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import configModel from "~/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";

import {
  useConfigModel,
  useSolvedConfigModel,
  usePartitionable,
  useAddPartition,
  useEditPartition,
} from "~/hooks/model/storage/config-model";
import {
  deviceSize,
  deviceLabel,
  parseToBytes,
  findPartitionableDevice,
  createPartitionableLocation,
} from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { STORAGE as PATHS, STORAGE } from "~/routes/paths";
import { isUndefined } from "radashi";
import { compact } from "~/utils";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import {
  NO_VALUE,
  REUSE_FILESYSTEM,
  useMountPointError,
  useSizeError,
  useErrorsHandler,
  useDefaultFilesystem,
  useUsableFilesystems,
  useUnusedMountPoints,
  useAutoRefreshFilesystem,
  useAutoRefreshSize,
  mountPointSelectOptions,
  sizeToString,
  DeviceDescription,
  FilesystemSelect,
  FilesystemLabel,
  AutoSizeInfo,
  type BaseFormValue,
  type SizeMode,
  type SizeRange,
  type SizeOptionValue,
} from "~/components/storage/VolumeFormShared";

const NEW_PARTITION = "new";

type FormValue = BaseFormValue & {
  target: string;
};

function toPartitionConfig(value: FormValue): ConfigModel.Partition {
  const name = (): string | undefined => {
    if (value.target === NO_VALUE || value.target === NEW_PARTITION) return undefined;

    return value.target;
  };

  const filesystemType = (): ConfigModel.FilesystemType | undefined => {
    if (value.filesystem === NO_VALUE) return undefined;

    /**
     * @note This type cast is needed because the list of filesystems coming from a volume is not
     *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
     *  whatever value coming from such a list as a filesystem type accepted by the config model.
     *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
     *  config model. The schema for the volumes will define the explicit list of filesystem types.
     */
    return value.filesystem as ConfigModel.FilesystemType;
  };

  const filesystem = (): ConfigModel.Filesystem | undefined => {
    if (value.filesystem === REUSE_FILESYSTEM) return { reuse: true, default: true };

    const type = filesystemType();
    if (type === undefined) return undefined;

    return {
      default: false,
      type,
      label: value.filesystemLabel,
    };
  };

  const size = (): ConfigModel.Size | undefined => {
    if (value.sizeOption === "auto") return undefined;
    if (value.minSize === NO_VALUE) return undefined;

    return {
      default: false,
      min: parseToBytes(value.minSize),
      max: value.maxSize === NO_VALUE ? undefined : parseToBytes(value.maxSize),
    };
  };

  return {
    mountPath: value.mountPoint,
    name: name(),
    filesystem: filesystem(),
    size: size(),
  };
}

function toFormValue(partitionConfig: ConfigModel.Partition): FormValue {
  const mountPoint = (): string => partitionConfig.mountPath || NO_VALUE;

  const target = (): string => partitionConfig.name || NEW_PARTITION;

  const filesystem = (): string => {
    const fsConfig = partitionConfig.filesystem;
    if (fsConfig.reuse) return REUSE_FILESYSTEM;
    if (!fsConfig.type) return NO_VALUE;

    return fsConfig.type;
  };

  const filesystemLabel = (): string => partitionConfig.filesystem?.label || NO_VALUE;

  const sizeOption = (): SizeOptionValue => {
    const reusePartition = partitionConfig.name !== undefined;
    const sizeConfig = partitionConfig.size;
    if (reusePartition) return NO_VALUE;
    if (!sizeConfig || sizeConfig.default) return "auto";

    return "custom";
  };

  return {
    mountPoint: mountPoint(),
    target: target(),
    filesystem: filesystem(),
    filesystemLabel: filesystemLabel(),
    sizeOption: sizeOption(),
    minSize: sizeToString(partitionConfig.size?.min),
    maxSize: sizeToString(partitionConfig.size?.max),
  };
}

function useDeviceModelFromParams(): Partitionable.Device | null {
  const { collection, index } = useParams();
  const location = createPartitionableLocation(collection, index);
  const deviceModel = usePartitionable(location.collection, location.index);

  return deviceModel;
}

function useDeviceFromParams(): System.Device {
  const deviceModel = useDeviceModelFromParams();
  return useDevice(deviceModel.name);
}

function usePartition(target: string): System.Device | null {
  const device = useDeviceFromParams();

  if (target === NEW_PARTITION) return null;

  const partitions = device.partitions || [];
  return partitions.find((p: System.Device) => p.name === target);
}

function usePartitionFilesystem(target: string): string | null {
  const partition = usePartition(target);
  return partition?.filesystem?.type || null;
}

function useInitialPartitionConfig(): ConfigModel.Partition | null {
  const { partitionId: mountPath } = useParams();
  const device = useDeviceModelFromParams();
  return mountPath && device ? configModel.partitionable.findPartition(device, mountPath) : null;
}

function useInitialFormValue(): FormValue | null {
  const partitionConfig = useInitialPartitionConfig();

  const value = React.useMemo(
    () => (partitionConfig ? toFormValue(partitionConfig) : null),
    [partitionConfig],
  );

  return value;
}

/** Unused partitions. Includes the currently used partition when editing (if any). */
function useUnusedPartitions(): System.Device[] {
  const device = useDeviceFromParams();
  const allPartitions = device.partitions || [];
  const initialPartitionConfig = useInitialPartitionConfig();
  const deviceModel = useDeviceModelFromParams();
  const configuredPartitionConfigs = configModel.partitionable
    .filterConfiguredExistingPartitions(deviceModel)
    .filter((p) => p.name !== initialPartitionConfig?.name)
    .map((p) => p.name);

  return allPartitions.filter((p) => !configuredPartitionConfigs.includes(p.name));
}

function useSolvedModel(value: FormValue): ConfigModel.Config | null {
  const { collection, index } = useParams();
  const device = useDeviceModelFromParams();
  const model = useConfigModel();
  const initialPartitionConfig = useInitialPartitionConfig();
  const mountPointErr = useMountPointError(value.mountPoint, initialPartitionConfig?.mountPath);
  const sizeErr = useSizeError(value.sizeOption, value.minSize, value.maxSize);
  const errors = compact([mountPointErr, sizeErr]);
  const partitionConfig = toPartitionConfig(value);
  partitionConfig.size = undefined;
  if (partitionConfig.filesystem) partitionConfig.filesystem.label = undefined;

  const modelCollection = collection === "drives" ? "drives" : "mdRaids";

  let sparseModel: ConfigModel.Config | undefined;

  if (device && !errors.length && value.target === NEW_PARTITION && value.filesystem !== NO_VALUE) {
    if (initialPartitionConfig) {
      sparseModel = configModel.partition.edit(
        model,
        modelCollection,
        Number(index),
        initialPartitionConfig.mountPath,
        partitionConfig,
      );
    } else {
      sparseModel = configModel.partition.add(
        model,
        modelCollection,
        Number(index),
        partitionConfig,
      );
    }
  }

  const solvedModel = useSolvedConfigModel(sparseModel);
  return solvedModel;
}

function useSolvedPartitionConfig(value: FormValue): ConfigModel.Partition | undefined {
  const { collection, index } = useParams();
  const model = useSolvedModel(value);
  if (!model) return;

  const device = findPartitionableDevice(model, collection, index);
  return device?.partitions?.find((p) => p.mountPath === value.mountPoint);
}

function useSolvedSizes(value: FormValue): SizeRange {
  // Remove size values in order to get a solved size.
  const valueWithoutSizes: FormValue = {
    ...value,
    sizeOption: NO_VALUE,
    minSize: NO_VALUE,
    maxSize: NO_VALUE,
  };

  const solvedPartitionConfig = useSolvedPartitionConfig(valueWithoutSizes);

  const solvedSizes = React.useMemo(() => {
    const min = solvedPartitionConfig?.size?.min;
    const max = solvedPartitionConfig?.size?.max;

    return {
      min: min ? deviceSize(min) : NO_VALUE,
      max: max ? deviceSize(max) : NO_VALUE,
    };
  }, [solvedPartitionConfig]);

  return solvedSizes;
}

type TargetOptionLabelProps = {
  value: string;
};

function TargetOptionLabel({ value }: TargetOptionLabelProps): React.ReactNode {
  const device = useDeviceFromParams();
  const partition = usePartition(value);

  if (value === NEW_PARTITION) {
    // TRANSLATORS: %s is a disk name with its size (eg. "sda, 10 GiB"
    return sprintf(_("As a new partition on %s"), deviceLabel(device, true));
  } else {
    return sprintf(_("Using partition %s"), deviceLabel(partition, true));
  }
}

function TargetOptions(): React.ReactNode {
  const partitions = useUnusedPartitions();

  return (
    <SelectList aria-label={_("Mount point options")}>
      <SelectOption value={NEW_PARTITION}>
        <TargetOptionLabel value={NEW_PARTITION} />
      </SelectOption>
      <Divider />
      <SelectGroup label={_("Using an existing partition")}>
        {partitions.map((partition, index) => (
          <SelectOption
            key={index}
            value={partition.name}
            description={<DeviceDescription device={partition} />}
          >
            {deviceLabel(partition)}
          </SelectOption>
        ))}
        {partitions.length === 0 && (
          <SelectOption isDisabled>{_("There are not usable partitions")}</SelectOption>
        )}
      </SelectGroup>
    </SelectList>
  );
}

/**
 * @fixme This component has to be adapted to use the new hooks from ~/hooks/storage/ instead of the
 * deprecated hooks from ~/queries/storage/config-model.
 */
const PartitionPageForm = () => {
  const { collection, index } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mountPoint, setMountPoint] = React.useState(NO_VALUE);
  const [target, setTarget] = React.useState(NEW_PARTITION);
  const [filesystem, setFilesystem] = React.useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = React.useState(NO_VALUE);
  const [sizeOption, setSizeOption] = React.useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = React.useState(NO_VALUE);
  const [maxSize, setMaxSize] = React.useState(NO_VALUE);
  // Filesystem and size selectors should not be auto refreshed before the user interacts with other
  // selectors like the mount point or the target selectors.
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = React.useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = React.useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, target, filesystem, filesystemLabel, sizeOption, minSize, maxSize };

  const initialPartitionConfig = useInitialPartitionConfig();
  const mountPointError = useMountPointError(mountPoint, initialPartitionConfig?.mountPath);
  const sizeError = useSizeError(sizeOption, minSize, maxSize);
  const { errors, getVisibleError } = useErrorsHandler(compact([mountPointError, sizeError]));

  const device = useDeviceModelFromParams();

  const unusedMountPoints = useUnusedMountPoints(initialPartitionConfig?.mountPath);

  const addPartition = useAddPartition();
  const editPartition = useEditPartition();

  // Initializes the form values if there is an initial value (i.e., when editing a partition).
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setTarget(initialValue.target);
      setFilesystem(initialValue.filesystem);
      setFilesystemLabel(initialValue.filesystemLabel);
      setSizeOption(initialValue.sizeOption);
      setMinSize(initialValue.minSize);
      setMaxSize(initialValue.maxSize);
    }
  }, [
    initialValue,
    setMountPoint,
    setTarget,
    setFilesystem,
    setFilesystemLabel,
    setSizeOption,
    setMinSize,
    setMaxSize,
  ]);

  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const partitionFilesystem = usePartitionFilesystem(target);
  const solvedSizes = useSolvedSizes(value);
  const solvedPartitionConfig = useSolvedPartitionConfig(value);

  const refreshFilesystemHandler = React.useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem, setFilesystem],
  );

  useAutoRefreshFilesystem(refreshFilesystemHandler, {
    mountPoint,
    target,
    newTargetValue: NEW_PARTITION,
    defaultFilesystem,
    usableFilesystems,
    targetFilesystem: partitionFilesystem,
  });

  const refreshSizeHandler = React.useCallback(
    (sizeOption, minSize, maxSize) => {
      if (autoRefreshSize) {
        setSizeOption(sizeOption);
        setMinSize(minSize);
        setMaxSize(maxSize);
      }
    },
    [autoRefreshSize, setSizeOption, setMinSize, setMaxSize],
  );

  useAutoRefreshSize(refreshSizeHandler, {
    target,
    newTargetValue: NEW_PARTITION,
    solvedMinSize: solvedSizes.min,
    solvedMaxSize: solvedSizes.max,
  });

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setAutoRefreshFilesystem(true);
      setAutoRefreshSize(true);
      setMountPoint(value);
    }
  };

  const changeTarget = (value: string) => {
    setAutoRefreshFilesystem(true);
    setAutoRefreshSize(true);
    setTarget(value);
  };

  const changeFilesystem = (value: string) => {
    setAutoRefreshFilesystem(false);
    setAutoRefreshSize(false);
    setFilesystem(value);
  };

  const changeSizeMode = (mode: SizeMode, size: SizeRange) => {
    setSizeOption(mode);
    setMinSize(size.min);
    if (mode === "custom" && initialValue?.sizeOption === "auto" && size.min !== size.max) {
      // Automatically stop using a range of sizes when a range is used by default.
      setMaxSize("");
    } else {
      setMaxSize(size.max);
    }
  };

  const onSubmit = () => {
    const partitionConfig = toPartitionConfig(value);
    const partitionableLocation = createPartitionableLocation(collection, index);
    if (!partitionableLocation) return;

    if (initialValue)
      editPartition(
        partitionableLocation.collection,
        partitionableLocation.index,
        initialValue.mountPoint,
        partitionConfig,
      );
    else
      addPartition(partitionableLocation.collection, partitionableLocation.index, partitionConfig);

    navigate({ pathname: PATHS.root, search: location.search });
  };

  const isFormValid = errors.length === 0;
  const visibleMountPointError = getVisibleError("mountPoint");
  const usedMountPt = visibleMountPointError ? NO_VALUE : mountPoint;
  const showLabel = filesystem !== NO_VALUE && filesystem !== REUSE_FILESYSTEM;
  const sizeMode: SizeMode = sizeOption === "" ? "auto" : sizeOption;
  const sizeRange: SizeRange = { min: minSize, max: maxSize };

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: device.name },
        // FIXME: evaluate if worth going for Edit/add or keep usign "Configure"
        // since Agama still doing neither, adding or editing, but defining a
        // partition
        // { label: initialValue ? _("Edit partition") : _("Add partition") },
        { label: _("Configure partition") },
      ]}
    >
      <Page.Content>
        <Form
          id="partitionForm"
          aria-label={sprintf(_("Configure partition at %s"), device.name)}
          onSubmit={onSubmit}
        >
          <Stack hasGutter>
            <FormGroup fieldId="mountPoint" label={_("Mount point")}>
              <Flex>
                <FlexItem>
                  <SelectTypeaheadCreatable
                    id="mountPoint"
                    toggleName={_("Mount point toggle")}
                    listName={_("Suggested mount points")}
                    inputName={_("Mount point")}
                    clearButtonName={_("Clear selected mount point")}
                    value={mountPoint}
                    options={mountPointSelectOptions(unusedMountPoints)}
                    createText={_("Use")}
                    onChange={changeMountPoint}
                  />
                </FlexItem>
                <FlexItem>
                  <Select
                    toggleName={_("Mount point mode")}
                    value={target}
                    label={<TargetOptionLabel value={target} />}
                    onChange={changeTarget}
                  >
                    <TargetOptions />
                  </Select>
                </FlexItem>
              </Flex>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem
                    variant={visibleMountPointError ? "error" : "default"}
                    screenReaderText=""
                  >
                    {!visibleMountPointError && _("Select or enter a mount point")}
                    {visibleMountPointError?.message}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup>
              <Flex>
                <FlexItem>
                  <FormGroup fieldId="fileSystem" label={_("File system")}>
                    <FilesystemSelect
                      id="fileSystem"
                      value={filesystem}
                      mountPoint={usedMountPt}
                      target={target}
                      targetFilesystem={partitionFilesystem}
                      defaultFilesystem={defaultFilesystem}
                      usableFilesystems={usableFilesystems}
                      defaultOptText={
                        mountPoint
                          ? sprintf(_("Default file system for %s"), mountPoint)
                          : _("Default file system for generic partitions")
                      }
                      formatTextWithData={_("Destroy current data and format partition as")}
                      formatTextWithoutData={_("Format partition as")}
                      onChange={changeFilesystem}
                    />
                  </FormGroup>
                </FlexItem>
                {showLabel && (
                  <FlexItem>
                    <FormGroup fieldId="fileSystemLabel" label={_("Label")}>
                      <FilesystemLabel
                        id="fileSystemLabel"
                        value={filesystemLabel}
                        onChange={setFilesystemLabel}
                      />
                    </FormGroup>
                  </FlexItem>
                )}
              </Flex>
            </FormGroup>
            {target === NEW_PARTITION && (
              <FormGroup fieldId="sizeMode" label={_("Size mode")}>
                {usedMountPt === NO_VALUE && (
                  <Select
                    id="sizeMode"
                    value={NO_VALUE}
                    label={_("Waiting for a mount point")}
                    isDisabled
                  />
                )}
                {usedMountPt !== NO_VALUE && (
                  <SizeModeSelect
                    id="sizeMode"
                    value={sizeMode}
                    size={sizeRange}
                    onChange={changeSizeMode}
                    automaticHelp={
                      <AutoSizeInfo
                        mountPoint={mountPoint}
                        size={solvedPartitionConfig?.size}
                        deviceType="partition"
                      />
                    }
                  />
                )}
              </FormGroup>
            )}
            <ActionGroup>
              <Page.Submit isDisabled={!isFormValid} form="partitionForm" />
              <Page.Cancel />
            </ActionGroup>
          </Stack>
        </Form>
      </Page.Content>
    </Page>
  );
};

export default function PartitionPage() {
  const device = useDeviceModelFromParams();

  return isUndefined(device) ? (
    <ResourceNotFound linkText={_("Go to storage page")} linkPath={STORAGE.root} />
  ) : (
    <PartitionPageForm />
  );
}
