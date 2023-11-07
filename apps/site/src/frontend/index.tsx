// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).global = window;

import "./ui-kit/index";

/* @refresh reload */
import { render } from "solid-js/web";
import { Header } from "./components/header";
import { Root, Page } from "./ui-kit";
import { Routes, Route, Router } from "@solidjs/router";
import { Show } from "solid-js";
import { MyMasksPage } from "./pages/cabinet/my-masks";
import { GlobalStore, useLoader } from "./store/global";
import { LoginPage } from "./pages/integration/login";
import { MySessionsPage } from "./pages/cabinet/my-sessions";
import { MyLinksPage } from "./pages/cabinet/my-links";
import { MyAssetsPage } from "./pages/cabinet/my-assets";
import { Loader } from "./components/loader";
import CabinetRoot from "./pages/cabinet";
import IntegrationRoot from "./pages/integration";
import { StatisticsPage } from "./pages/statistics";
import { NotificationBar } from "./components/notification-bar";
import { SendPage } from "./pages/cabinet/my-assets/send";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

function LoaderWrapper() {
  const [loaderVisible] = useLoader();

  return (
    <Show when={loaderVisible()}>
      <Loader />
    </Show>
  );
}

export function App() {
  return (
    <Root>
      <GlobalStore>
        <NotificationBar />
        <Header />
        <Page>
          <Router>
            <Routes>
              <Route path="/integration" component={IntegrationRoot}>
                <Route path="/login" component={LoginPage} />
              </Route>
              <Route path="/cabinet" component={CabinetRoot}>
                <Route path="/my-masks" component={MyMasksPage} />
                <Route path="/my-sessions" component={MySessionsPage} />
                <Route path="/my-links" component={MyLinksPage} />
                <Route path="/my-assets">
                  <Route path="/" component={MyAssetsPage} />
                  <Route path="/send" component={SendPage} />
                </Route>
              </Route>
              <Route path="/statistics" component={StatisticsPage} />
            </Routes>
          </Router>
        </Page>
        <LoaderWrapper />
      </GlobalStore>
    </Root>
  );
}

render(App, root!);
