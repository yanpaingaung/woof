import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [base],
    multiInjectedProviderDiscovery: false,
    connectors: [
      baseAccount({
        appName: "WOOFonBASE",
        appLogoUrl: "https://wooftranslator.vercel.app/woofhead.png",
      }),
    ],
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: {
      [base.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
