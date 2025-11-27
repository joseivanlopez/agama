/*
 * Copyright (c) [2025] SUSE LLC
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

import { useSuspenseQuery } from "@tanstack/react-query";
import { storageModelQuery } from "~/hooks/api/storage";
import { mountPaths } from "~/storage/api-model";
import type { model } from "~/api/storage";

function selectMountPaths(data: model.Config | null): string[] {
  return data ? mountPaths(data) : [];
}

function useMountPaths(): string[] {
  const { data } = useSuspenseQuery({
    ...storageModelQuery,
    select: selectMountPaths,
  });
  return data;
}

export { storageModelQuery, useMountPaths };
