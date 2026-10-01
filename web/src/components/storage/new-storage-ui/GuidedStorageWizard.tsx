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
import { Button, Stack } from "@patternfly/react-core";
import { _ } from "~/i18n";
import Popup from "~/components/core/Popup";
import { Disk, PartitionAction, WizardResult } from "./types";
import SelectDiskStep from "./wizard/SelectDiskStep";
import HandleContentStep from "./wizard/HandleContentStep";
import StorageOptionsStep from "./wizard/StorageOptionsStep";

interface GuidedStorageWizardProps {
  disks: Disk[];
  onClose: () => void;
  onComplete: (result: WizardResult) => void;
}

export default function GuidedStorageWizard({
  disks,
  onClose,
  onComplete,
}: GuidedStorageWizardProps): React.ReactElement {
  const [selectedDisk, setSelectedDisk] = useState<string | null>(null);
  const [partitionActions, setPartitionActions] = useState<Record<string, PartitionAction>>({});
  const [useLvm, setUseLvm] = useState(false);
  const [useEncryption, setUseEncryption] = useState(false);

  const selectedDiskData = disks.find((d) => d.name === selectedDisk);

  const handleFinish = () => {
    if (!selectedDisk) return;

    onComplete({
      selectedDisk,
      partitionActions,
      useLvm,
      useEncryption,
    });
  };

  const [currentStep, setCurrentStep] = useState(0);

  const canGoNext = () => {
    if (currentStep === 0) return selectedDisk !== null;
    return true;
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <SelectDiskStep
            disks={disks}
            selectedDisk={selectedDisk}
            onSelectDisk={setSelectedDisk}
          />
        );
      case 1:
        return (
          <HandleContentStep
            disk={selectedDiskData}
            partitionActions={partitionActions}
            onPartitionActionsChange={setPartitionActions}
          />
        );
      case 2:
        return (
          <StorageOptionsStep
            disk={selectedDiskData}
            useLvm={useLvm}
            useEncryption={useEncryption}
            onUseLvmChange={setUseLvm}
            onUseEncryptionChange={setUseEncryption}
          />
        );
      default:
        return null;
    }
  };

  const stepTitles = [
    _("Select Installation Disk"),
    _("Handle Existing Content"),
    _("Storage Options"),
  ];

  return (
    <Popup
      variant="large"
      title={_("Guided Storage Setup")}
      description={`${_("Step")} ${currentStep + 1}/3: ${stepTitles[currentStep]}`}
      isOpen
      onClose={onClose}
      actions={
        <>
          {currentStep > 0 && (
            <Button variant="secondary" onClick={handleBack}>
              {_("Back")}
            </Button>
          )}
          <Button variant="primary" onClick={handleNext} isDisabled={!canGoNext()}>
            {currentStep === 2 ? _("Finish") : _("Next")}
          </Button>
          <Button variant="link" onClick={onClose}>
            {_("Cancel")}
          </Button>
        </>
      }
    >
      <Stack hasGutter>{renderStep()}</Stack>
    </Popup>
  );
}
