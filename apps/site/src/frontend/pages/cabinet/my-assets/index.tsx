import { For, Match, Show, Switch, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { AllAssetData, makeIcrc1Salt, useAllAssetData } from "../../../store/cabinet";
import { CabinetHeading } from "../../../ui-kit";
import {
  AddAssetBtn,
  AddAssetForm,
  AddAssetHeader,
  AddAssetInput,
  AddAssetWrapper,
  AssetAccountsWrapper,
  AssetAddAccountBtn,
  AssetAddAccountBtnIconWrapper,
  AssetAddAccountBtnText,
  AssetSpoilerContent,
  AssetSpoilerHeader,
  MyAssetsPageContent,
} from "./style";
import { Spoiler } from "../../../components/spoiler";
import { Dim, Title } from "../../../components/typography/style";
import { AccountCard } from "../../../components/account-card";
import {
  DEFAULT_PRINCIPAL,
  ONE_MIN_MS,
  assertEventSafe,
  getAssetMetadata,
  makeAgent,
  tokensToStr,
} from "../../../utils";
import { Principal, TAccountId, delay } from "@fort-major/masquerade-shared";
import { useLoader, useMasqueradeClient } from "../../../store/global";
import { MasqueradeIdentity } from "@fort-major/masquerade-client";
import { AnonymousIdentity } from "@dfinity/agent";
import { IcrcLedgerCanister } from "@dfinity/ledger-icrc";
import { PlusIcon } from "../../../components/typography/icons";
import { ISendPopupProps, SendPopup } from "./send";
import { SetStoreFunction, produce } from "solid-js/store";
import { useNavigate } from "@solidjs/router";

export function MyAssetsPage() {
  const client = useMasqueradeClient();
  const [allAssetData, setAllAssetData, allAssetDataFetched, allAssetDataKeys] = useAllAssetData();
  const [newAssetId, setNewAssetId] = createSignal<string>("");
  const [error, setError] = createSignal<string | undefined>();

  const [sendPopupProps, setSendPopupProps] = createSignal<ISendPopupProps | null>(null);
  const [sendPopupVisible, showSendPopup] = createSignal(false);

  const navigate = useNavigate();

  const [_, showLoader] = useLoader();
  createEffect(() => showLoader(!allAssetDataFetched()));

  const [int] = createSignal(
    setInterval(async () => {
      const anonIdentity = new AnonymousIdentity();
      const agent = await makeAgent(anonIdentity);

      const assetIds = Object.keys(allAssetData);

      for (let assetId of assetIds) {
        if (allAssetData[assetId]?.metadata === undefined) continue;

        const ledger = IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(assetId) });
        const accounts = allAssetData[assetId]?.accounts || [];

        for (let accountId = 0; accountId < accounts.length; accountId++) {
          if (accounts[accountId].principal) updateBalanceOf(ledger, allAssetData, setAllAssetData, assetId, accountId);
        }
      }
    }, ONE_MIN_MS * 2),
  );

  onCleanup(() => clearInterval(int()));

  const handleEdit = async (assetId: string, accountId: TAccountId, newName: string) => {
    await client()!.editAssetAccount(assetId, accountId, newName);

    setAllAssetData(assetId, "accounts", accountId, "name", newName);
  };

  const handleAddAccount = async (assetId: string, assetName: string, symbol: string) => {
    const name = await client()!.addAssetAccount(assetId, assetName, symbol);

    if (name === null) return;

    const accountId = allAssetData[assetId]!.accounts.length;

    setAllAssetData(assetId, "accounts", accountId, { name, balance: BigInt(0), principal: DEFAULT_PRINCIPAL });

    const identity = await MasqueradeIdentity.create(client()!.getInner(), makeIcrc1Salt(assetId, accountId));
    const principal = identity.getPrincipal();

    setAllAssetData(assetId, "accounts", accountId, "principal", principal.toText());

    const anonIdentity = new AnonymousIdentity();
    const agent = await makeAgent(anonIdentity);
    const ledger = IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(assetId) });

    const balance = await ledger.balance({ certified: true, owner: principal });

    setAllAssetData(assetId, "accounts", accountId, "balance", balance);

    const totalBalance = allAssetData[assetId]!.accounts.reduce((prev, cur) => prev + (cur.balance || 0n), 0n);
    setAllAssetData(assetId, "totalBalance", totalBalance);
  };

  const handleAddAsset = async (e: Event) => {
    assertEventSafe(e);

    const assetId = newAssetId();

    const existing = allAssetData[assetId];
    if (existing) {
      setError(`Token ${existing.metadata?.name} (${assetId}) already exists`);
      return;
    }

    const msq = client()!;

    const anonIdentity = new AnonymousIdentity();
    const agent = await makeAgent(anonIdentity);
    const ledger = IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(assetId) });

    try {
      const metadata = await getAssetMetadata(ledger, assetId);
      const assetData = await msq.addAsset(assetId, metadata.name, metadata.symbol);

      setNewAssetId("");
      if (assetData === null) return;

      setAllAssetData(assetId, { metadata });
      setAllAssetData(assetId, "accounts", 0, {
        name: assetData.accounts[0],
        balance: BigInt(0),
        principal: DEFAULT_PRINCIPAL,
      });

      const identity = await MasqueradeIdentity.create(msq.getInner(), makeIcrc1Salt(assetId, 0));
      const principal = identity.getPrincipal();

      setAllAssetData(assetId, "accounts", 0, "principal", principal.toText());

      const balance = await ledger.balance({ certified: true, owner: principal });

      setAllAssetData(assetId, "totalBalance", balance);
      setAllAssetData(assetId, "accounts", 0, "balance", balance);
    } catch (e) {
      console.error(e);
      setError(`Token ${assetId} is not a valid ICRC-1 token or unresponsive`);
    }
  };

  const handleSend = (accountId: TAccountId, assetId: string) => {
    const assetData = allAssetData[assetId]!;
    const account = assetData.accounts[accountId];

    const sendProps: ISendPopupProps = {
      accountId,
      assetId,
      balance: account.balance!,
      name: account.name,
      principal: account.principal!,
      symbol: assetData.metadata!.symbol,
      decimals: assetData.metadata!.decimals,
      fee: assetData.metadata!.fee,
    };

    setSendPopupProps(sendProps);
    showSendPopup(true);
  };

  const handleCancelSend = async (result: boolean) => {
    showSendPopup(false);

    if (result) {
      const anonIdentity = new AnonymousIdentity();
      const agent = await makeAgent(anonIdentity);
      const ledger = IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(sendPopupProps()!.assetId) });

      const accounts = allAssetData[sendPopupProps()!.assetId]!.accounts;

      for (let accountId = 0; accountId < accounts.length; accountId++) {
        await updateBalanceOf(ledger, allAssetData, setAllAssetData, sendPopupProps()!.assetId, accountId);
      }
    }

    setSendPopupProps(null);
  };

  return (
    <Switch>
      <Match when={!(sendPopupVisible() && sendPopupProps() !== null)}>
        <CabinetHeading>My Assets</CabinetHeading>
        <MyAssetsPageContent>
          <For each={allAssetDataKeys()}>
            {(assetId) => (
              <Spoiler
                header={
                  <AssetSpoilerHeader>
                    <Show when={allAssetData[assetId]?.metadata} fallback={<Title>{assetId}</Title>}>
                      <Title>{allAssetData[assetId]!.metadata!.name}</Title>
                    </Show>
                    <Show
                      when={allAssetData[assetId]?.metadata}
                      fallback={
                        <Title>
                          0 <Dim>TOK</Dim>
                        </Title>
                      }
                    >
                      <Title>
                        {tokensToStr(allAssetData[assetId]!.totalBalance, allAssetData[assetId]!.metadata!.decimals)}{" "}
                        <Dim>{allAssetData[assetId]!.metadata!.symbol}</Dim>
                      </Title>
                    </Show>
                  </AssetSpoilerHeader>
                }
              >
                <Show when={allAssetData[assetId]?.metadata}>
                  <AssetSpoilerContent>
                    <AssetAccountsWrapper>
                      <For each={allAssetData[assetId]!.accounts}>
                        {(account, idx) => (
                          <AccountCard
                            accountId={idx()}
                            assetId={assetId}
                            name={account.name}
                            principal={account.principal}
                            balance={account.balance}
                            symbol={allAssetData[assetId]!.metadata!.symbol}
                            decimals={allAssetData[assetId]!.metadata!.decimals}
                            onSend={handleSend}
                            onReceive={() => {}}
                            onEdit={(newName) => handleEdit(assetId, idx(), newName)}
                          />
                        )}
                      </For>
                    </AssetAccountsWrapper>
                    <AssetAddAccountBtn
                      onClick={() =>
                        handleAddAccount(
                          assetId,
                          allAssetData[assetId]!.metadata!.name,
                          allAssetData[assetId]!.metadata!.symbol,
                        )
                      }
                    >
                      <AssetAddAccountBtnIconWrapper>
                        <PlusIcon />
                      </AssetAddAccountBtnIconWrapper>
                      <AssetAddAccountBtnText>
                        Add New {allAssetData[assetId]!.metadata!.symbol} Account
                      </AssetAddAccountBtnText>
                    </AssetAddAccountBtn>
                  </AssetSpoilerContent>
                </Show>
              </Spoiler>
            )}
          </For>
          <AddAssetWrapper>
            <AddAssetHeader>Add custom ICRC-1 asset</AddAssetHeader>
            <AddAssetForm>
              <AddAssetInput
                placeholder="Type token’s canister ID here..."
                value={newAssetId()}
                onInput={(e) => setNewAssetId(e.target.value)}
              />
              <AddAssetBtn onClick={handleAddAsset}>Add</AddAssetBtn>
            </AddAssetForm>
          </AddAssetWrapper>
        </MyAssetsPageContent>
      </Match>
      <Match when={sendPopupVisible() && sendPopupProps() !== null}>
        <SendPopup {...sendPopupProps()!} onCancel={handleCancelSend} />
      </Match>
    </Switch>
  );
}

async function updateBalanceOf(
  ledger: IcrcLedgerCanister,
  allAssetData: AllAssetData,
  setAllAssetData: SetStoreFunction<AllAssetData>,
  assetId: string,
  accountId: number,
) {
  const balance = await ledger.balance({
    certified: true,
    owner: Principal.fromText(allAssetData[assetId]!.accounts[accountId].principal!),
  });

  setAllAssetData(
    produce((state) => {
      state[assetId]!.accounts[accountId].balance = balance;
      const totalBalance = state[assetId]!.accounts!.reduce((prev, cur) => prev + (cur.balance || 0n), 0n);

      state[assetId]!.totalBalance = totalBalance;
    }),
  );
}
