import {
  type IIdentityAddRequest,
  type IIdentityGetLoginOptionsRequest,
  type IIdentityGetLoginOptionsResponse,
  type IIdentityLoginRequest,
  type IShowICRC1TransferConfirmRequest,
  type IStatistics,
  SNAP_METHODS,
  type TIdentityId,
  type TOrigin,
  IStateGetAllOriginDataResponse,
  IIdentityEditPseudonymRequest,
  IMask,
  IIdentityStopSessionRequest,
  IIdentityUnlinkOneRequest,
  IIdentityUnlinkAllRequest,
  IStateGetAllAssetDataResponse,
  IAssetDataExternal,
  IICRC1AddAssetRequest,
  IICRC1AddAssetAccountRequest,
  IICRC1EditAssetAccountRequest,
  IStateGetAllAssetDataRequest,
  IStateGetAllOriginDataRequest,
  unreacheable,
  ErrorCode,
} from "@fort-major/masquerade-shared";
import { MasqueradeClient } from "./client";

export class InternalSnapClient {
  static create(client: MasqueradeClient | undefined): InternalSnapClient {
    return new InternalSnapClient(client);
  }

  getInner(): MasqueradeClient {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    return this.inner;
  }

  async register(toOrigin: TOrigin): Promise<IMask | null> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityAddRequest = { toOrigin };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.add, body);
  }

  async login(
    toOrigin: TOrigin,
    withIdentityId: TIdentityId,
    withDeriviationOrigin: TOrigin = toOrigin,
  ): Promise<true> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityLoginRequest = {
      toOrigin,
      withLinkedOrigin: withDeriviationOrigin,
      withIdentityId,
    };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.login, body);
  }

  async getLoginOptions(forOrigin: TOrigin): Promise<IIdentityGetLoginOptionsResponse> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityGetLoginOptionsRequest = { forOrigin };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.getLoginOptions, body);
  }

  async getAllOriginData(origins?: string[]): Promise<IStateGetAllOriginDataResponse> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IStateGetAllOriginDataRequest = { origins };

    return await this.inner._requestSnap(SNAP_METHODS.protected.state.getAllOriginData, body);
  }

  async getAllAssetData(assetIds?: string[]): Promise<IStateGetAllAssetDataResponse> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IStateGetAllAssetDataRequest = { assetIds };

    return await this.inner._requestSnap(SNAP_METHODS.protected.state.getAllAssetData, body);
  }

  async addAsset(req: IICRC1AddAssetRequest): Promise<IAssetDataExternal[] | null> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    return await this.inner._requestSnap(SNAP_METHODS.protected.icrc1.addAsset, req);
  }

  async addAssetAccount(assetId: string, assetName: string, assetSymbol: string): Promise<string | null> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IICRC1AddAssetAccountRequest = { assetId, name: assetName, symbol: assetSymbol };

    return await this.inner._requestSnap(SNAP_METHODS.protected.icrc1.addAssetAccount, body);
  }

  async editAssetAccount(assetId: string, accountId: number, newName: string): Promise<void> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IICRC1EditAssetAccountRequest = { assetId, accountId, newName };

    return await this.inner._requestSnap(SNAP_METHODS.protected.icrc1.editAssetAccount, body);
  }

  async editPseudonym(origin: TOrigin, identityId: TIdentityId, newPseudonym: string): Promise<void> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityEditPseudonymRequest = {
      origin,
      identityId,
      newPseudonym,
    };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.editPseudonym, body);
  }

  async stopSession(origin: TOrigin): Promise<boolean> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityStopSessionRequest = {
      origin,
    };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.stopSession, body);
  }

  async unlinkOne(origin: TOrigin, withOrigin: TOrigin): Promise<boolean> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityUnlinkOneRequest = {
      origin,
      withOrigin,
    };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.unlinkOne, body);
  }

  async unlinkAll(origin: TOrigin): Promise<boolean> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    const body: IIdentityUnlinkAllRequest = {
      origin,
    };

    return await this.inner._requestSnap(SNAP_METHODS.protected.identity.unlinkAll, body);
  }

  async showICRC1TransferConfirm(body: IShowICRC1TransferConfirmRequest): Promise<boolean> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    return await this.inner._requestSnap(SNAP_METHODS.protected.icrc1.showTransferConfirm, body);
  }

  async getStats(): Promise<IStatistics> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    return await this.inner._requestSnap(SNAP_METHODS.protected.statistics.get);
  }

  async resetStats(): Promise<true> {
    if (!this.inner) unreacheable("Don't use uninitialized client");

    return await this.inner._requestSnap(SNAP_METHODS.protected.statistics.reset);
  }

  constructor(private readonly inner: MasqueradeClient | undefined) {}
}
