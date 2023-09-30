import { IOriginData, IState, toCBOR, fromCBOR, TOrigin, unreacheable, zodParse, ZState } from "@fort-major/masquerade-shared";

export class StateManager {
    public getOriginData(origin: TOrigin): IOriginData {
        return this.state.originData[origin] || DEFAULT_ORIGIN_DATA;
    }

    public setOriginData(origin: TOrigin, data: IOriginData) {
        this.state.originData[origin] = data;
    }

    public linkExists(from: TOrigin, to: TOrigin): boolean {
        const fromHasToLink = this.state.originData[from]?.linksTo?.includes(to) || false;
        const toHasFromLink = this.state.originData[to]?.linksFrom?.includes(from) || false;

        if ((fromHasToLink && !toHasFromLink) || (!fromHasToLink && toHasFromLink)) {
            unreacheable('There should always be two sides of a link');
        }

        return fromHasToLink;
    }

    public link(from: TOrigin, to: TOrigin) {
        const fromOriginData = this.getOriginData(from);
        const toOriginData = this.getOriginData(to);

        fromOriginData.linksTo.push(to);
        toOriginData.linksFrom.push(from);

        this.setOriginData(from, fromOriginData);
        this.setOriginData(to, toOriginData);
    }

    public unlink(from: TOrigin, to: TOrigin) {
        const fromOriginData = this.getOriginData(from);
        const toOriginData = this.getOriginData(to);

        const fromIdx = fromOriginData.linksTo.findIndex(it => it === to);
        const toIdx = toOriginData.linksFrom.findIndex(it => it === from);

        if (fromIdx === -1 || toIdx === -1) unreacheable('To unlink there should be a link');

        fromOriginData.linksTo.splice(fromIdx, 1);
        toOriginData.linksFrom.splice(toIdx, 1);

        this.setOriginData(from, fromOriginData);
        this.setOriginData(to, toOriginData);
    }

    public addIdentity(origin: TOrigin) {
        const originData = this.state.originData[origin] || DEFAULT_ORIGIN_DATA;
        originData.identitiesTotal += 1;

        this.state.originData[origin] = originData;
    }

    constructor(private state: IState) { }

    public static async make(): Promise<StateManager> {
        const state = await retrieveStateLocal();

        return new StateManager(state);
    }

    public async persist() {
        return await persistStateLocal(this.state);
    }
}

const DEFAULT_STATE: IState = {
    originData: {}
};

export const DEFAULT_ORIGIN_DATA: IOriginData = {
    identitiesTotal: 1,
    currentSession: undefined,
    linksFrom: [],
    linksTo: [],
};

export async function retrieveStateLocal(): Promise<IState> {
    let state = await snap.request({
        method: "snap_manageState",
        params: {
            operation: "get"
        }
    });

    if (!state) {
        await persistStateLocal(DEFAULT_STATE);
        return DEFAULT_STATE;
    }

    // @ts-expect-error
    const data = fromCBOR(state.data);

    return zodParse(ZState, data);
}

export async function persistStateLocal(state: IState): Promise<void> {
    await snap.request({
        method: "snap_manageState",
        params: {
            operation: "update",
            newState: { data: toCBOR(state) },
        }
    });
}