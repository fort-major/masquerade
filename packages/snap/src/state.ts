import {
  type IOriginData,
  type IState,
  type IStatistics,
  type TOrigin,
  unreacheable,
  zodParse,
  ZState,
  fromCBOR,
  toCBOR,
  TIdentityId,
  IMask,
  err,
  ErrorCode,
  IAssetData,
  TAccountId,
  EStatisticsKind,
  PRE_LISTED_TOKENS,
} from "@fort-major/masquerade-shared";
import { generateRandomPseudonym, getSignIdentity } from "./utils";

/**
 * Provides a higher-level interface for interacting with the snap's state.
 *
 * @keywords state, memory, data, persistence
 */
export class StateManager {
  /**
   * @param origin - origin to get data about
   * @returns - existing links, current session and a total number of user identities
   */
  public async getOriginData(origin: TOrigin): Promise<IOriginData> {
    let originData = this.state.originData[origin];

    if (originData === undefined) {
      const mask = await this.makeMask(origin, 0);
      originData = makeDefaultOriginData(mask);
    }

    return originData;
  }

  public setOriginData(origin: TOrigin, data: IOriginData): void {
    this.state.originData[origin] = data;
  }

  public getAllOriginData(): { [x: TOrigin]: IOriginData | undefined } {
    return this.state.originData;
  }

  public getAllAssetData(): { [x: string]: IAssetData | undefined } {
    return this.state.assetData;
  }

  public editPseudonym(origin: TOrigin, identityId: TIdentityId, newPseudonym: string) {
    const originData = this.state.originData[origin];

    if (originData === undefined) {
      err(ErrorCode.INVALID_INPUT, `No origin data exists ${origin}`);
    }

    if (Object.keys(originData.masks).length <= identityId) {
      err(ErrorCode.INVALID_INPUT, `No mask exists ${identityId}`);
    }

    originData.masks[identityId]!.pseudonym = newPseudonym;
  }

  public linkExists(from: TOrigin, to: TOrigin): boolean {
    const fromHasToLink = this.state.originData[from]?.linksTo[to] ?? false;
    const toHasFromLink = this.state.originData[to]?.linksFrom[from] ?? false;

    if ((fromHasToLink && !toHasFromLink) || (!fromHasToLink && toHasFromLink)) {
      unreacheable("There should always be two sides of a link");
    }

    return fromHasToLink;
  }

  public async link(from: TOrigin, to: TOrigin): Promise<void> {
    const fromOriginData = await this.getOriginData(from);
    const toOriginData = await this.getOriginData(to);

    if (fromOriginData.linksTo[to]) {
      unreacheable(`Unable to add an existing TO link: ${from} -> ${to}`);
    }
    if (toOriginData.linksFrom[from]) {
      unreacheable(`Unable to add an existing FROM link: ${from} -> ${to}`);
    }

    fromOriginData.linksTo[to] = true;
    toOriginData.linksFrom[from] = true;

    this.setOriginData(from, fromOriginData);
    this.setOriginData(to, toOriginData);
  }

  public async unlink(from: TOrigin, to: TOrigin): Promise<void> {
    const fromOriginData = await this.getOriginData(from);
    const toOriginData = await this.getOriginData(to);

    if (!fromOriginData.linksTo[to]) {
      unreacheable(`Unable to delete a non-existing TO link: ${from} -> ${to}`);
    }
    if (!toOriginData.linksFrom[from]) {
      unreacheable(`Unable to delete a non-existing FROM link: ${from} -> ${to}`);
    }

    delete fromOriginData.linksTo[to];
    delete toOriginData.linksFrom[from];

    this.setOriginData(from, fromOriginData);
    this.setOriginData(to, toOriginData);
  }

  public async unlinkAll(from: TOrigin): Promise<TOrigin[]> {
    const fromOriginData = await this.getOriginData(from);
    const oldLinks = Object.keys(fromOriginData.linksTo);

    for (let to of oldLinks) {
      const toOriginData = await this.getOriginData(to);
      delete toOriginData.linksFrom[from];

      this.setOriginData(to, toOriginData);
    }

    fromOriginData.linksTo = {};
    this.setOriginData(from, fromOriginData);

    return oldLinks;
  }

  public async addIdentity(origin: TOrigin): Promise<IMask> {
    let originData = this.state.originData[origin];

    if (originData === undefined) {
      const mask = await this.makeMask(origin, 0);
      originData = makeDefaultOriginData(mask);
    }

    const identityId = Object.keys(originData.masks).length;
    const mask = await this.makeMask(origin, identityId);
    originData.masks[identityId] = mask;

    this.state.originData[origin] = originData;

    return mask;
  }

  public addAsset(assetId: string): IAssetData {
    let assetData = this.state.assetData[assetId];

    if (assetData !== undefined) return assetData;

    assetData = makeDefaultAssetData();

    this.state.assetData[assetId] = assetData;

    return assetData;
  }

  public addAssetAccount(assetId: string): string {
    const assetData = this.state.assetData[assetId];

    if (assetData === undefined) unreacheable(`No asset exists ${assetId}`);

    const accountId = Object.keys(assetData.accounts).length;
    const name = `Account #${accountId}`;
    assetData.accounts[accountId] = name;

    return name;
  }

  public editAssetAccount(assetId: string, accountId: TAccountId, newName: string) {
    const assetData = this.state.assetData[assetId];

    if (assetData === undefined) unreacheable(`No asset exists ${assetId}`);
    if (Object.keys(assetData.accounts).length <= accountId) unreacheable(`No account exists ${assetId} ${accountId}`);

    assetData.accounts[accountId] = newName;
  }

  private async makeMask(origin: TOrigin, identityId: TIdentityId): Promise<IMask> {
    const identity = await getSignIdentity(origin, identityId, new Uint8Array());
    const principal = identity.getPrincipal();
    const prinBytes = principal.toUint8Array();
    const seed1 = prinBytes[3];
    const seed2 = prinBytes[4];

    return { pseudonym: generateRandomPseudonym(seed1, seed2), principal: principal.toText() };
  }

  constructor(private readonly state: IState) {}

  public static async make(): Promise<StateManager> {
    const state = await retrieveStateWrapped();

    return new StateManager(state);
  }

  public static async persist(): Promise<void> {
    return persistStateLocal();
  }

  public incrementStats(
    kind: EStatisticsKind,
    icrc1_sent?: { ticker: keyof typeof PRE_LISTED_TOKENS; qty: bigint },
  ): void {
    switch (kind) {
      case EStatisticsKind.MasksCreated:
        this.state.statistics.prod.masks_created += 1;
        break;

      case EStatisticsKind.SignaturesProduced:
        this.state.statistics.prod.signatures_produced += 1;
        break;

      case EStatisticsKind.OriginsLinked:
        this.state.statistics.prod.origins_linked += 1;
        break;

      case EStatisticsKind.OriginsUnlinked:
        this.state.statistics.prod.origins_unlinked += 1;
        break;

      case EStatisticsKind.Icrc1AccountsCreated:
        this.state.statistics.prod.icrc1_accounts_created += 1;
        break;

      case EStatisticsKind.Icrc1Sent: {
        if (icrc1_sent == undefined) {
          unreacheable("No icrc1 stat body provided");
        }

        // @ts-expect-error - types are consistent
        this.state.statistics.prod.icrc1_sent[icrc1_sent.ticker] += icrc1_sent.qty;

        break;
      }
    }
  }

  public getStats(): IStatistics {
    return this.state.statistics;
  }

  public resetStats(): void {
    this.state.statistics = makeDefaultStatistics();
  }
}

function makeDefaultState(): IState {
  return {
    version: 1,
    originData: {},
    assetData: {},
    statistics: makeDefaultStatistics(),
  };
}

function makeDefaultStatistics(): IStatistics {
  return {
    lastResetTimestamp: Date.now(),
    prod: {
      masks_created: 0,
      signatures_produced: 0,
      origins_linked: 0,
      origins_unlinked: 0,
      icrc1_accounts_created: 0,
      icrc1_sent: {
        ICP: BigInt(0),
        ckBTC: BigInt(0),
        CHAT: BigInt(0),
        SONIC: BigInt(0),
        SNS1: BigInt(0),
        OGY: BigInt(0),
        MOD: BigInt(0),
        GHOST: BigInt(0),
        KINIC: BigInt(0),
        HOT: BigInt(0),
        CAT: BigInt(0),
      },
    },
  };
}

function makeDefaultOriginData(mask: IMask): IOriginData {
  return {
    masks: { 0: mask },
    currentSession: undefined,
    linksFrom: {},
    linksTo: {},
  };
}

function makeDefaultAssetData(): IAssetData {
  return {
    accounts: { 0: "Main" },
  };
}

let STATE: IState | null = null;
let LAST_STATE_PERSIST_TIMESTAMP = 0;
let STATE_UPDATE_TIMESTAMP = 0;

async function retrieveStateWrapped(): Promise<IState> {
  if (STATE === null) {
    const state = await snap.request({
      method: "snap_manageState",
      params: {
        operation: "get",
      },
    });

    if (state == null) {
      const s = makeDefaultState();
      STATE = s;

      STATE_UPDATE_TIMESTAMP = Date.now();
    } else {
      STATE = zodParse(ZState, fromCBOR(state.data as string));
    }
  }

  return createDeepOnChangeProxy(STATE, () => {
    STATE_UPDATE_TIMESTAMP = Date.now();
  }) as IState;
}

let proxyCache = new WeakMap();

function createDeepOnChangeProxy(target: any, onChange: () => void): unknown {
  return new Proxy(target, {
    get(target, property) {
      const item = target[property];
      if (item && typeof item === "object") {
        if (proxyCache.has(item)) return proxyCache.get(item);
        const proxy = createDeepOnChangeProxy(item, onChange);
        proxyCache.set(item, proxy);
        return proxy;
      }
      return item;
    },
    set(target, property, newValue) {
      target[property] = newValue;
      onChange();
      return true;
    },
  });
}

async function persistStateLocal(): Promise<void> {
  if (LAST_STATE_PERSIST_TIMESTAMP >= STATE_UPDATE_TIMESTAMP) return;

  zodParse(ZState, STATE);

  LAST_STATE_PERSIST_TIMESTAMP = Date.now();

  await snap.request({
    method: "snap_manageState",
    params: {
      operation: "update",
      newState: { data: toCBOR(STATE) },
    },
  });
}
