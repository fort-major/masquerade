// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).global = window;

/* @refresh reload */
import { render } from "solid-js/web";
import { Header } from "./components/header";
import { Root, Page } from "./styles";
import { Routes, Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
import { MyMasksPage } from "./pages/cabinet/my-masks";
import { GlobalStore } from "./store/global";
import { LoginPage } from "./pages/integration/login";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

export function App() {
  const CabinetRoot = lazy(() => import("./pages/cabinet"));
  const IntegrationRoot = lazy(() => import("./pages/integration"));

  return (
    <Root>
      <Header />
      <Page>
        <GlobalStore>
          <Router>
            <Routes>
              <Route path="/integration" component={IntegrationRoot}>
                <Route path="/login" component={LoginPage} />
              </Route>
              <Route path="/cabinet" component={CabinetRoot}>
                <Route path="/my-masks" component={MyMasksPage} />
              </Route>
            </Routes>
          </Router>
        </GlobalStore>
      </Page>
    </Root>
  );
}

render(App, root!);
