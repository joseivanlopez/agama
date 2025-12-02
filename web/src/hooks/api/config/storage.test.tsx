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

import React, { Suspense } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useReset } from "./storage";
import * as api from "~/api";
import { Config } from "~/model/config";

// Mock the API calls
jest.mock("~/api", () => ({
  getConfig: jest.fn(),
  putConfig: jest.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

describe("useReset", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    (api.getConfig as jest.Mock).mockClear();
    (api.putConfig as jest.Mock).mockClear();
  });

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );

  it("should return a function that resets storage config", async () => {
    const mockConfig: Config = {
      product: { id: "sles" },
      storage: {
        // some storage config
      },
    };
    (api.getConfig as jest.Mock).mockResolvedValue(mockConfig);
    (api.putConfig as jest.Mock).mockResolvedValue({ status: 200 });

    const { result } = renderHook(() => useReset(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(result.current).toBeInstanceOf(Function));

    act(() => {
      result.current();
    });

    const expectedConfig: Config = { ...mockConfig, storage: undefined };

    await waitFor(() => expect(api.putConfig).toHaveBeenCalledWith(expectedConfig));
    expect(api.getConfig).toHaveBeenCalledTimes(1);
    expect(api.putConfig).toHaveBeenCalledTimes(1);
  });

  it("should handle null config from API", async () => {
    (api.getConfig as jest.Mock).mockResolvedValue(null);
    (api.putConfig as jest.Mock).mockResolvedValue({ status: 200 });

    const { result } = renderHook(() => useReset(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(result.current).toBeInstanceOf(Function));

    act(() => {
      result.current();
    });

    await waitFor(() => expect(api.putConfig).toHaveBeenCalledWith({}));
    expect(api.getConfig).toHaveBeenCalledTimes(1);
    expect(api.putConfig).toHaveBeenCalledTimes(1);
  });
});
