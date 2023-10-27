import { TAccountId } from "@fort-major/masquerade-shared";
import { DEFAULT_PRINCIPAL, assertEventSafe, tokensToStr } from "../../utils";
import {
  AccountCardDivider,
  AccountCardFooter,
  AccountCardFooterBalance,
  AccountCardFooterBalanceQty,
  AccountCardFooterBalanceSymbol,
  AccountCardFooterButtons,
  AccountCardFooterContent,
  AccountCardHeader,
  AccountCardHeaderName,
  AccountCardHeaderNameInput,
  AccountCardHeaderNameWrapper,
  AccountCardHeaderPrincipal,
  AccountCardReceiveBtn,
  AccountCardSendBtn,
  AccountCardWrapper,
} from "./style";
import { Match, Show, Switch, createSignal } from "solid-js";
import { EditIcon, ReceiveIcon, SendIcon } from "../typography/icons";

export interface IAccountCardProps {
  accountId: TAccountId;
  name: string;
  principal: string | undefined;
  balance: bigint;
  decimals: number;
  symbol: string;
  onSend: (accountId: TAccountId) => void;
  onReceive: (principal: string) => void;
  onEdit: (newName: string) => void;
}

export function AccountCard(props: IAccountCardProps) {
  const [edited, setEdited] = createSignal(false);
  const initialName = () => props.name;
  const [name, setName] = createSignal(initialName());

  const handleEditStart = (e: Event) => {
    assertEventSafe(e);

    if (!edited()) {
      setEdited(true);
      return;
    }
  };

  const handleEditFinishByEnter = (e: KeyboardEvent) => {
    assertEventSafe(e);

    if (e.key === "Enter") {
      setEdited(false);
      props.onEdit(name());
    }
  };

  const handleEditFinishByUnfocus = (e: Event) => {
    assertEventSafe(e);

    setEdited(false);
    props.onEdit(name());
  };

  return (
    <AccountCardWrapper>
      <AccountCardHeader>
        <Switch>
          <Match when={edited()}>
            <AccountCardHeaderNameInput
              ref={(it) => setTimeout(() => it.focus(), 1)}
              type="text"
              value={name()}
              onKeyDown={handleEditFinishByEnter}
              onChange={handleEditFinishByUnfocus}
              onInput={(e) => setName(e.target.value)}
            />
          </Match>
          <Match when={!edited()}>
            <AccountCardHeaderNameWrapper onClick={handleEditStart}>
              <AccountCardHeaderName>{props.name}</AccountCardHeaderName>
              <EditIcon />
            </AccountCardHeaderNameWrapper>
          </Match>
        </Switch>

        <Show
          when={props.principal}
          fallback={<AccountCardHeaderPrincipal>{DEFAULT_PRINCIPAL}</AccountCardHeaderPrincipal>}
        >
          <AccountCardHeaderPrincipal>{props.principal}</AccountCardHeaderPrincipal>
        </Show>
      </AccountCardHeader>
      <AccountCardFooter>
        <AccountCardDivider />
        <AccountCardFooterContent>
          <AccountCardFooterBalance>
            <AccountCardFooterBalanceQty>{tokensToStr(props.balance, props.decimals)}</AccountCardFooterBalanceQty>
            <AccountCardFooterBalanceSymbol>{props.symbol}</AccountCardFooterBalanceSymbol>
          </AccountCardFooterBalance>
          <AccountCardFooterButtons>
            <AccountCardSendBtn disabled={props.principal === undefined} onClick={() => props.onSend(props.accountId)}>
              <SendIcon />
            </AccountCardSendBtn>
            <AccountCardReceiveBtn
              disabled={props.principal === undefined}
              onClick={() => props.onReceive(props.principal!)}
            >
              <ReceiveIcon />
            </AccountCardReceiveBtn>
          </AccountCardFooterButtons>
        </AccountCardFooterContent>
      </AccountCardFooter>
    </AccountCardWrapper>
  );
}