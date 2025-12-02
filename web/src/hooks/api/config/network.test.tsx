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
import {
  useConnectionMutation,
  useConfigMutation,
  useConnection,
  useConnections,
  useConfig,
} from "./network";
import * as api from "~/api";
import {
  Connection,
  NetworkConfig,
  type APIConnection,
  ConnectionStatus,
  ConnectionState,
  ConnectionMethod,
} from "~/types/network";
import { Config } from "~/model/config";

jest.mock("~/api", () => ({
  getConfig: jest.fn(),
  getProposal: jest.fn(),
  patchConfig: jest.fn(),
}));

const mockToApi = jest.fn();
const mockConnectionFromApi = jest.fn();
const mockNetworkConfigFromApi = jest.fn();

jest.mock("~/types/network", () => {
  const actual = jest.requireActual("~/types/network");
  return {
    ...actual,
    Connection: class {
      static fromApi = (...args) => mockConnectionFromApi(...args);
      toApi = (...args) => mockToApi(...args);
    },
    NetworkConfig: class {
      static fromApi = (...args) => mockNetworkConfigFromApi(...args);
      toApi = jest.fn();
    },
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

describe("network config hooks", () => {
  let queryClient: QueryClient;

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
    mockToApi.mockClear();
    mockConnectionFromApi.mockClear();
    mockNetworkConfigFromApi.mockClear();
  });

  describe("useConfig", () => {
    it("should return network config", async () => {
      const mockApiConfig = { connections: [] };
      const mockConfig = { network: mockApiConfig };
      const mockNetworkConfig = new NetworkConfig();
      (api.getConfig as jest.Mock).mockResolvedValue(mockConfig);
      mockNetworkConfigFromApi.mockReturnValue(mockNetworkConfig);

      const { result } = renderHook(() => useConfig(), { wrapper: TestWrapper });

      await waitFor(() => expect(result.current).toEqual(mockNetworkConfig));
      expect(api.getConfig).toHaveBeenCalledTimes(1);
      expect(mockNetworkConfigFromApi).toHaveBeenCalledWith(mockApiConfig);
    });
  });

  describe("useConnections", () => {
    it("should return connections from proposal", async () => {
      const mockApiConnection: APIConnection = {
        id: "eth0",
        method4: ConnectionMethod.AUTO,
        method6: ConnectionMethod.AUTO,
        persistent: true,
        state: ConnectionState.activated,
        status: ConnectionStatus.UP,
      };
      const mockProposal = {
        network: { connections: [mockApiConnection] },
      };
      const mockConnection = { id: "eth0" };

      (api.getProposal as jest.Mock).mockResolvedValue(mockProposal);
      mockConnectionFromApi.mockReturnValue(mockConnection);

      const { result } = renderHook(() => useConnections(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => expect(result.current).toEqual([mockConnection]));
      expect(api.getProposal).toHaveBeenCalledTimes(1);
      expect(mockConnectionFromApi).toHaveBeenCalledWith(mockApiConnection);
    });
  });

  describe("useConnection", () => {
    const mockApiConnection1: APIConnection = {
      id: "eth0",
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      persistent: true,
      state: ConnectionState.activated,
      status: ConnectionStatus.UP,
    };
    const mockApiConnection2: APIConnection = {
      id: "eth1",
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      persistent: true,
      state: ConnectionState.activated,
      status: ConnectionStatus.UP,
    };
    const mockProposal = {
      network: { connections: [mockApiConnection1, mockApiConnection2] },
    };
    const mockConnection1 = { id: "eth0" };
    const mockConnection2 = { id: "eth1" };

    beforeEach(() => {
      (api.getProposal as jest.Mock).mockResolvedValue(mockProposal);
      mockConnectionFromApi.mockImplementation((c: APIConnection) => {
        if (c.id === "eth0") {
          return mockConnection1;
        }
        if (c.id === "eth1") {
          return mockConnection2;
        }
        return undefined;
      });
    });

    it("should return a specific connection by id", async () => {
      const { result } = renderHook(() => useConnection("eth1"), {
        wrapper: TestWrapper,
      });

      await waitFor(() => expect(result.current).toEqual(mockConnection2));
    });

    it("should return undefined if connection not found", async () => {
      const { result } = renderHook(() => useConnection("br0"), {
        wrapper: TestWrapper,
      });

      await waitFor(() => expect(result.current).toBeUndefined());
    });
  });

  describe("useConnectionMutation", () => {
    it("should update a connection and invalidate queries", async () => {
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      (api.patchConfig as jest.Mock).mockResolvedValue({ status: 200 });

      const apiConn = { id: "some-eth" };
      mockToApi.mockReturnValue(apiConn);
      const mockConnection = new Connection("");

      const { result } = renderHook(() => useConnectionMutation(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.mutate(mockConnection);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockToApi).toHaveBeenCalledTimes(1);
      expect(api.patchConfig).toHaveBeenCalledTimes(1);
      expect(api.patchConfig).toHaveBeenCalledWith({
        network: { connections: [apiConn] },
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["proposal"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["system"],
      });
    });
  });

  describe("useConfigMutation", () => {
    it("should update config and invalidate queries", async () => {
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      (api.patchConfig as jest.Mock).mockResolvedValue({ status: 200 });

      const mockConfig: Config = {
        network: {},
      };

      const { result } = renderHook(() => useConfigMutation(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.mutate(mockConfig);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.patchConfig).toHaveBeenCalledTimes(1);
      expect(api.patchConfig).toHaveBeenCalledWith(mockConfig);

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["proposal"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["system"],
      });
    });
  });
});
