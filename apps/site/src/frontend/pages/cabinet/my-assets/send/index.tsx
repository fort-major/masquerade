import { AccountCard } from "../../../../components/account-card";
import { Input } from "../../../../ui-kit/input";
import {
  DEFAULT_PRINCIPAL,
  DEFAULT_SUBACCOUNT,
  getRandomMemo,
  makeAgent,
  makeIcrc1Salt,
  tokensToStr,
} from "../../../../utils";
import { Match, Show, Switch, createSignal, onMount } from "solid-js";
import { Principal } from "@dfinity/principal";
import { Button, EButtonKind } from "../../../../ui-kit/button";
import { EIconKind } from "../../../../ui-kit/icon";
import { createStore } from "solid-js/store";
import { useMasqueradeClient } from "../../../../store/global";
import { DISCORD_LINK, debugStringify, hexToBytes } from "@fort-major/masquerade-shared";
import { MasqueradeIdentity } from "@fort-major/masquerade-client";
import { IcrcLedgerCanister } from "@dfinity/ledger-icrc";
import {
  ButtonsWrapper,
  FeeLine,
  FeeLineAmount,
  FeeLineAmountQty,
  FeeLineAmountSymbol,
  FeeLineReason,
  FeeLinesWrapper,
  SendPopupBg,
  SendPopupBody,
  SendPopupHeading,
  SendPopupWrapper,
} from "./style";
import { useSendPageProps } from "../../../../store/cabinet";
import { useNavigate } from "@solidjs/router";
import {
  H3,
  Span400,
  Span600,
  SpanAccent,
  SpanError,
  SpanGray115,
  SpanGray140,
  SpanGray165,
  SpanLink,
  Text14,
  Text20,
  Text24,
} from "../../../../ui-kit/typography";
import {
  CheckoutResultBtn,
  CheckoutResultContent,
  CheckoutResultSection,
} from "../../../integration/payment/checkout/style";

export interface ISendPageProps {
  accountId: number;
  assetId: string;
  name: string;
  principal: string;
  balance: bigint;
  decimals: number;
  symbol: string;
  fee: bigint;

  onCancel: (result: boolean) => void;
}

export interface ITxnResult {
  success: boolean;
  blockIdx?: bigint | undefined;
  error?: string | undefined;
  totalAmount?: string | undefined;
}

const VALID_HEX_SYMBOLS = "0123456789abcdefABCDEF".split("");
const validateHex = (hex: string) =>
  hex.split("").every((c) => VALID_HEX_SYMBOLS.includes(c)) && hex.length % 2 == 0 ? null : "Invalid hex string";

export function SendPage() {
  const [recipientPrincipal, setRecipientPrincipal] = createSignal<Principal | null>(null);
  const [recipientSubaccount, setRecipientSubaccount] = createSignal<string | null>(null);
  const [memo, setMemo] = createSignal<string | null>(null);
  const [amount, setAmount] = createSignal<bigint>(0n);
  const [correctArr, setCorrectArr] = createStore([false, true, true, false]);
  const [txnResult, setTxnResult] = createSignal<ITxnResult | null>(null);
  const [sending, setSending] = createSignal(false);

  const navigate = useNavigate();
  const [props] = useSendPageProps();

  onMount(() => {
    if (!props()) navigate("/cabinet/my-assets");
  });

  const msq = useMasqueradeClient();

  const isCorrect = () => correctArr.every((it) => it);

  const handleSend = async () => {
    setSending(true);

    const subaccount = recipientSubaccount() ? hexToBytes(recipientSubaccount()!) : undefined;

    const agreed = await msq()!.showICRC1TransferConfirm({
      requestOrigin: window.location.origin,
      ticker: props()!.symbol,
      from: props()!.principal,
      to: {
        owner: recipientPrincipal()!.toText(),
        subaccount,
      },
      totalAmount: amount() + props()!.fee,
      totalAmountStr: tokensToStr(amount() + props()!.fee, props()!.decimals, true),
    });

    if (!agreed) {
      setSending(false);
      return;
    }

    const identity = await MasqueradeIdentity.create(
      msq()!.getInner(),
      makeIcrc1Salt(props()!.assetId, props()!.accountId),
    );
    const agent = await makeAgent(identity);
    const ledger = IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(props()!.assetId) });

    try {
      const blockIdx = await ledger.transfer({
        created_at_time: BigInt(Date.now()) * 1_000_000n,
        to: {
          owner: recipientPrincipal()!,
          subaccount: subaccount ? [subaccount] : [],
        },
        amount: amount(),
        memo: memo() ? hexToBytes(memo()!) : getRandomMemo(),
      });

      setTxnResult({
        success: true,
        blockIdx,
        totalAmount: tokensToStr(amount() + props()!.fee, props()!.decimals),
      });
    } catch (e) {
      let err = debugStringify(e);

      setTxnResult({ success: false, error: err });
    } finally {
      setSending(false);
    }
  };

  return (
    <Show when={props()}>
      <SendPopupBg center={txnResult() !== null}>
        <SendPopupWrapper>
          <Switch>
            <Match when={txnResult() === null}>
              <SendPopupHeading>Send {props()!.symbol}</SendPopupHeading>
              <SendPopupBody>
                <AccountCard
                  fullWidth
                  accountId={props()!.accountId}
                  assetId={props()!.assetId}
                  name={props()!.name}
                  principal={props()!.principal}
                  balance={props()!.balance}
                  decimals={props()!.decimals}
                  symbol={props()!.symbol}
                />
                <Input
                  label="Principal ID"
                  placeholder={DEFAULT_PRINCIPAL}
                  required
                  disabled={sending()}
                  onErr={(e) => setCorrectArr(0, !e)}
                  KindPrincipal={{ onChange: setRecipientPrincipal }}
                />
                <Input
                  label="Subaccount"
                  placeholder={DEFAULT_SUBACCOUNT}
                  disabled={sending()}
                  onErr={(e) => setCorrectArr(1, !e)}
                  KindString={{ onChange: setRecipientSubaccount, validate: validateHex }}
                />
                <Input
                  label="Memo"
                  placeholder="Enter your memo"
                  disabled={sending()}
                  onErr={(e) => setCorrectArr(2, !e)}
                  KindString={{ onChange: setMemo, validate: validateHex }}
                />
                <FeeLinesWrapper>
                  <Input
                    label="Send Amount"
                    placeholder="1,234.5678"
                    required
                    disabled={sending()}
                    onErr={(e) => setCorrectArr(3, !e)}
                    KindTokens={{
                      onChange: setAmount,
                      decimals: props()!.decimals,
                      symbol: props()!.symbol,
                      validate: (val) =>
                        val + props()!.fee > props()!.balance
                          ? `Insufficient balance (max ${tokensToStr(
                              props()!.balance - props()!.fee,
                              props()!.decimals,
                            )})`
                          : null,
                    }}
                  />
                  <Show when={amount() !== BigInt(0)}>
                    <FeeLine>
                      <FeeLineAmount>
                        <FeeLineAmountQty>+{tokensToStr(props()!.fee, props()!.decimals)}</FeeLineAmountQty>
                        <FeeLineAmountSymbol>{props()!.symbol}</FeeLineAmountSymbol>
                      </FeeLineAmount>
                      <FeeLineReason>System Fee</FeeLineReason>
                    </FeeLine>
                  </Show>
                </FeeLinesWrapper>
                <ButtonsWrapper>
                  <Button
                    disabled={sending()}
                    onClick={() => props()!.onCancel(false)}
                    fullWidth
                    kind={EButtonKind.Additional}
                    text="Cancel"
                  />
                  <Show when={isCorrect()}>
                    <Button
                      disabled={sending()}
                      onClick={handleSend}
                      fullWidth
                      kind={EButtonKind.Primary}
                      text="Continue"
                      icon={sending() ? EIconKind.Loader : EIconKind.ArrowRightUp}
                    />
                  </Show>
                </ButtonsWrapper>
              </SendPopupBody>
            </Match>

            <Match when={txnResult()!.success}>
              <CheckoutResultContent>
                <CheckoutResultSection>
                  <H3>Success</H3>
                  <Text24>
                    <Span600>
                      Transaction #{txnResult()!.blockIdx!.toString()} has been <SpanAccent>sucessfully</SpanAccent>{" "}
                      executed
                    </Span600>
                  </Text24>
                </CheckoutResultSection>
                <CheckoutResultSection>
                  <Text24>
                    <Span600>
                      <SpanGray165>
                        {txnResult()!.totalAmount} {props()!.symbol} were deducted from your balance
                      </SpanGray165>
                    </Span600>
                  </Text24>
                </CheckoutResultSection>
                <CheckoutResultSection>
                  <Button
                    classList={{ [CheckoutResultBtn]: true }}
                    kind={EButtonKind.Primary}
                    text="Go Back"
                    onClick={() => props()!.onCancel(true)}
                  />
                </CheckoutResultSection>
              </CheckoutResultContent>
            </Match>
            <Match when={!txnResult()!.success}>
              <CheckoutResultContent>
                <CheckoutResultSection>
                  <H3>Fail</H3>
                  <Text24>
                    <Span600>
                      The transaction has <SpanError>failed</SpanError> to execute due to the following error:
                    </Span600>
                  </Text24>
                  <Text14>
                    <Span400>
                      <SpanGray140>{txnResult()!.error}</SpanGray140>
                    </Span400>
                  </Text14>
                </CheckoutResultSection>
                <CheckoutResultSection>
                  <Text24>
                    <Span600>
                      <SpanGray165>No funds were deducted from your balance</SpanGray165>
                    </Span600>
                  </Text24>
                  <Text20>
                    <SpanGray165>
                      Please, consider{" "}
                      <SpanLink href={DISCORD_LINK} target="_blank">
                        reporting
                      </SpanLink>{" "}
                      the error above
                    </SpanGray165>
                  </Text20>
                </CheckoutResultSection>
                <CheckoutResultSection>
                  <Button
                    kind={EButtonKind.Additional}
                    classList={{ [CheckoutResultBtn]: true }}
                    text="Go Back"
                    onClick={() => props()!.onCancel(false)}
                  />
                </CheckoutResultSection>
              </CheckoutResultContent>
            </Match>
          </Switch>
        </SendPopupWrapper>
      </SendPopupBg>
    </Show>
  );
}