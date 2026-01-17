import { db } from "../server/db";
import { vendors, blockchainChains } from "../shared/schema";
import { eq } from "drizzle-orm";

const vendorLogos: Record<string, string> = {
  "1password": "https://logo.clearbit.com/1password.com",
  "aws": "https://logo.clearbit.com/aws.amazon.com",
  "akamai": "https://logo.clearbit.com/akamai.com",
  "asana": "https://logo.clearbit.com/asana.com",
  "atlassian": "https://logo.clearbit.com/atlassian.com",
  "azure": "https://logo.clearbit.com/azure.microsoft.com",
  "box": "https://logo.clearbit.com/box.com",
  "carbonite": "https://logo.clearbit.com/carbonite.com",
  "circleci": "https://logo.clearbit.com/circleci.com",
  "cloudflare": "https://logo.clearbit.com/cloudflare.com",
  "cloudinary": "https://logo.clearbit.com/cloudinary.com",
  "datadog": "https://logo.clearbit.com/datadoghq.com",
  "datto": "https://logo.clearbit.com/datto.com",
  "digitalocean": "https://logo.clearbit.com/digitalocean.com",
  "dropbox": "https://logo.clearbit.com/dropbox.com",
  "duo": "https://logo.clearbit.com/duo.com",
  "fastly": "https://logo.clearbit.com/fastly.com",
  "fireblocks": "https://logo.clearbit.com/fireblocks.com",
  "github": "https://logo.clearbit.com/github.com",
  "gcp": "https://logo.clearbit.com/cloud.google.com",
  "googlews": "https://logo.clearbit.com/workspace.google.com",
  "hubspot": "https://logo.clearbit.com/hubspot.com",
  "kaseya": "https://logo.clearbit.com/kaseya.com",
  "lastpass": "https://logo.clearbit.com/lastpass.com",
  "linear": "https://logo.clearbit.com/linear.app",
  "linode": "https://logo.clearbit.com/linode.com",
  "mailgun": "https://logo.clearbit.com/mailgun.com",
  "microsoft365": "https://logo.clearbit.com/microsoft.com",
  "mongodb": "https://logo.clearbit.com/mongodb.com",
  "nable": "https://logo.clearbit.com/n-able.com",
  "newrelic": "https://logo.clearbit.com/newrelic.com",
  "notion": "https://logo.clearbit.com/notion.so",
  "openai": "https://logo.clearbit.com/openai.com",
  "netsuite": "https://logo.clearbit.com/netsuite.com",
  "paypal": "https://logo.clearbit.com/paypal.com",
  "pingidentity": "https://logo.clearbit.com/pingidentity.com",
  "quickbooks": "https://logo.clearbit.com/quickbooks.intuit.com",
  "render": "https://logo.clearbit.com/render.com",
  "salesforce": "https://logo.clearbit.com/salesforce.com",
  "sendgrid": "https://logo.clearbit.com/sendgrid.com",
  "sentinelone": "https://logo.clearbit.com/sentinelone.com",
  "sentry": "https://logo.clearbit.com/sentry.io",
  "shopify": "https://logo.clearbit.com/shopify.com",
  "slack": "https://logo.clearbit.com/slack.com",
  "supabase": "https://logo.clearbit.com/supabase.com",
  "syncro": "https://logo.clearbit.com/syncromsp.com",
  "teamviewer": "https://logo.clearbit.com/teamviewer.com",
  "twilio": "https://logo.clearbit.com/twilio.com",
  "vercel": "https://logo.clearbit.com/vercel.com",
  "zoom": "https://logo.clearbit.com/zoom.us",
  "auth0": "https://logo.clearbit.com/auth0.com",
  "okta": "https://logo.clearbit.com/okta.com",
  "stripe": "https://logo.clearbit.com/stripe.com",
  "connectwise": "https://logo.clearbit.com/connectwise.com",
};

const blockchainLogos: Record<string, string> = {
  "aptos": "https://cryptologos.cc/logos/aptos-apt-logo.png",
  "avalanche": "https://cryptologos.cc/logos/avalanche-avax-logo.png",
  "bsc": "https://cryptologos.cc/logos/bnb-bnb-logo.png",
  "bitcoin": "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  "celo": "https://cryptologos.cc/logos/celo-celo-logo.png",
  "cosmos": "https://cryptologos.cc/logos/cosmos-atom-logo.png",
  "ethereum": "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  "near": "https://cryptologos.cc/logos/near-protocol-near-logo.png",
  "polygon": "https://cryptologos.cc/logos/polygon-matic-logo.png",
  "solana": "https://cryptologos.cc/logos/solana-sol-logo.png",
  "stellar": "https://cryptologos.cc/logos/stellar-xlm-logo.png",
  "sui": "https://cryptologos.cc/logos/sui-sui-logo.png",
  "tron": "https://cryptologos.cc/logos/tron-trx-logo.png",
  "ripple": "https://cryptologos.cc/logos/xrp-xrp-logo.png",
  "thegraph": "https://cryptologos.cc/logos/the-graph-grt-logo.png",
  "arbitrum": "https://cryptologos.cc/logos/arbitrum-arb-logo.png",
  "optimism": "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png",
  "base": "https://logo.clearbit.com/base.org",
  "linea": "https://logo.clearbit.com/linea.build",
  "mantle": "https://logo.clearbit.com/mantle.xyz",
  "mode": "https://logo.clearbit.com/mode.network",
  "scroll": "https://logo.clearbit.com/scroll.io",
  "zksync": "https://logo.clearbit.com/zksync.io",
  "alchemy": "https://logo.clearbit.com/alchemy.com",
  "infura": "https://logo.clearbit.com/infura.io",
  "quicknode": "https://logo.clearbit.com/quicknode.com",
  "allnodes": "https://logo.clearbit.com/allnodes.com",
  "ankr": "https://cryptologos.cc/logos/ankr-ankr-logo.png",
  "binance": "https://cryptologos.cc/logos/binance-coin-bnb-logo.png",
  "blockdaemon": "https://logo.clearbit.com/blockdaemon.com",
  "bybit": "https://logo.clearbit.com/bybit.com",
  "chorusone": "https://logo.clearbit.com/chorus.one",
  "coinbase": "https://logo.clearbit.com/coinbase.com",
  "cryptocom": "https://cryptologos.cc/logos/cronos-cro-logo.png",
  "everstake": "https://logo.clearbit.com/everstake.one",
  "figment": "https://logo.clearbit.com/figment.io",
  "gemini": "https://logo.clearbit.com/gemini.com",
  "kiln": "https://logo.clearbit.com/kiln.fi",
  "kraken": "https://logo.clearbit.com/kraken.com",
  "lido": "https://cryptologos.cc/logos/lido-dao-ldo-logo.png",
  "marinade": "https://logo.clearbit.com/marinade.finance",
  "p2p": "https://logo.clearbit.com/p2p.org",
  "rockx": "https://logo.clearbit.com/rockx.com",
  "rocketpool": "https://cryptologos.cc/logos/rocket-pool-rpl-logo.png",
  "stakedao": "https://logo.clearbit.com/stakedao.org",
  "stakewise": "https://logo.clearbit.com/stakewise.io",
  "stakefish": "https://logo.clearbit.com/stake.fish",
  "argent": "https://logo.clearbit.com/argent.xyz",
  "bybitwallet": "https://logo.clearbit.com/bybit.com",
  "coinbasewallet": "https://logo.clearbit.com/coinbase.com",
  "exodus": "https://logo.clearbit.com/exodus.com",
  "gnosissafe": "https://logo.clearbit.com/safe.global",
  "ledger": "https://logo.clearbit.com/ledger.com",
  "metamask": "https://logo.clearbit.com/metamask.io",
  "okxwallet": "https://logo.clearbit.com/okx.com",
  "phantom": "https://logo.clearbit.com/phantom.app",
  "rainbow": "https://logo.clearbit.com/rainbow.me",
  "trezor": "https://logo.clearbit.com/trezor.io",
  "trustwallet": "https://logo.clearbit.com/trustwallet.com",
  "uniswap": "https://cryptologos.cc/logos/uniswap-uni-logo.png",
};

async function seedLogos() {
  console.log("Seeding vendor logos...");
  for (const [key, logoUrl] of Object.entries(vendorLogos)) {
    await db.update(vendors)
      .set({ logoUrl })
      .where(eq(vendors.key, key));
    console.log(`  Updated ${key}`);
  }

  console.log("\nSeeding blockchain logos...");
  for (const [key, logoUrl] of Object.entries(blockchainLogos)) {
    await db.update(blockchainChains)
      .set({ logoUrl })
      .where(eq(blockchainChains.key, key));
    console.log(`  Updated ${key}`);
  }

  console.log("\nLogo seeding complete!");
  process.exit(0);
}

seedLogos().catch((err) => {
  console.error("Error seeding logos:", err);
  process.exit(1);
});
