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
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useConfig, useExtendedConfig, useProduct } from "./config";
import * as api from "~/api";
import * as systemHooks from "~/hooks/api/system";
import { system } from "~/api";
import { Config } from "~/model/config";

// Mock the API calls
jest.mock("~/api", () => ({
  getConfig: jest.fn(),
  getExtendedConfig: jest.fn(),
}));

// Mock the useSystem hook
jest.mock("~/hooks/api/system", () => ({
  useSystem: jest.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // ✅ turns retries off
        retry: false,
        // ✅ set a very short staleTime to ensure queries are refetched during tests
        staleTime: 0,
      },
    },
  });

describe("config hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    (api.getConfig as jest.Mock).mockClear();
    (api.getExtendedConfig as jest.Mock).mockClear();
    (systemHooks.useSystem as jest.Mock).mockClear();
  });

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );

  describe("useConfig", () => {
    it("should return config data", async () => {
      const mockConfig: Config = { product: { id: "sles" } };
      (api.getConfig as jest.Mock).mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useConfig(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toEqual(mockConfig));
      expect(api.getConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if getConfig resolves to null", async () => {
      (api.getConfig as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useConfig(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(api.getConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if getConfig rejects", async () => {
      const testError = new Error("Network error");
      (api.getConfig as jest.Mock).mockRejectedValue(testError);

      const { result } = renderHook(() => useConfig(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current).toBeNull();
      });
      expect(api.getConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe("useExtendedConfig", () => {
    it("should return extended config data", async () => {
      const mockExtendedConfig: Config = { product: { id: "leap" } };
      (api.getExtendedConfig as jest.Mock).mockResolvedValue(mockExtendedConfig);

      const { result } = renderHook(() => useExtendedConfig(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => expect(result.current).toEqual(mockExtendedConfig));
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if getExtendedConfig resolves to null", async () => {
      (api.getExtendedConfig as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useExtendedConfig(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => expect(result.current).toBeNull());
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if getExtendedConfig rejects", async () => {
      const testError = new Error("Network error");
      (api.getExtendedConfig as jest.Mock).mockRejectedValue(testError);

      const { result } = renderHook(() => useExtendedConfig(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current).toBeNull();
      });
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe("useProduct", () => {
    const mockProducts: system.Product[] = [
      { id: "sles", name: "SLES", registration: true },
      { id: "leap", name: "Leap", registration: false },
    ];

    it("should return the matching product", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue({
        products: mockProducts,
      });
      (api.getExtendedConfig as jest.Mock).mockResolvedValue({
        product: { id: "sles" },
      });

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toEqual(mockProducts[0]));
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if no matching product is found", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue({
        products: mockProducts,
      });
      (api.getExtendedConfig as jest.Mock).mockResolvedValue({
        product: { id: "unknown" },
      });

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if extended config product is null", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue({
        products: mockProducts,
      });
      (api.getExtendedConfig as jest.Mock).mockResolvedValue({ product: null });

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if extended config is null", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue({
        products: mockProducts,
      });
      (api.getExtendedConfig as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if useSystem returns no products", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue({ products: [] });
      (api.getExtendedConfig as jest.Mock).mockResolvedValue({
        product: { id: "sles" },
      });

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if useSystem returns no 'products' property", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue({});
      (api.getExtendedConfig as jest.Mock).mockResolvedValue({
        product: { id: "sles" },
      });

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if useSystem returns null", async () => {
      (systemHooks.useSystem as jest.Mock).mockReturnValue(null);
      (api.getExtendedConfig as jest.Mock).mockResolvedValue({
        product: { id: "sles" },
      });

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null if getExtendedConfig rejects", async () => {
      const testError = new Error("some error");
      (systemHooks.useSystem as jest.Mock).mockReturnValue({
        products: mockProducts,
      });
      (api.getExtendedConfig as jest.Mock).mockRejectedValue(testError);

      const { result } = renderHook(() => useProduct(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toBeNull());
      expect(systemHooks.useSystem).toHaveBeenCalled();
      expect(api.getExtendedConfig).toHaveBeenCalledTimes(1);
    });
  });
});
