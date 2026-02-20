export const NEW_VENDORS = [
  // ═══════════════════════════════════════════════════════════════
  // CLOUD INFRASTRUCTURE & HOSTING
  // ═══════════════════════════════════════════════════════════════
  { key: "vultr", name: "Vultr", statusUrl: "https://www.vultr.com/status/", parser: "statuspage_json", status: "operational" },
  { key: "scaleway", name: "Scaleway", statusUrl: "https://status.scaleway.com", parser: "statuspage_json", status: "operational" },
  { key: "upcloud", name: "UpCloud", statusUrl: "https://status.upcloud.com", parser: "statuspage_json", status: "operational" },
  { key: "backblaze", name: "Backblaze", statusUrl: "https://www.backblazestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "hetzner", name: "Hetzner", statusUrl: "https://status.hetzner.com", parser: "generic_html", status: "operational" },
  { key: "ovhcloud", name: "OVHcloud", statusUrl: "https://www.status-ovhcloud.com", parser: "generic_html", status: "operational" },
  { key: "rackspace", name: "Rackspace", statusUrl: "https://status.rackspace.com", parser: "generic_html", status: "operational" },
  { key: "ibmcloud", name: "IBM Cloud", statusUrl: "https://cloud.ibm.com/status", parser: "generic_html", status: "operational" },
  { key: "oracle-cloud", name: "Oracle Cloud", statusUrl: "https://ocistatus.oraclecloud.com", parser: "generic_html", status: "operational" },
  { key: "dreamhost", name: "DreamHost", statusUrl: "https://www.dreamhoststatus.com", parser: "statuspage_json", status: "operational" },
  { key: "liquidweb", name: "Liquid Web", statusUrl: "https://status.liquidweb.com", parser: "statuspage_json", status: "operational" },
  { key: "kamatera", name: "Kamatera", statusUrl: "https://status.kamatera.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // CDN & DNS & EDGE
  // ═══════════════════════════════════════════════════════════════
  { key: "bunnynet", name: "Bunny.net", statusUrl: "https://status.bunny.net", parser: "statuspage_json", status: "operational" },
  { key: "keycdn", name: "KeyCDN", statusUrl: "https://status.keycdn.com", parser: "statuspage_json", status: "operational" },
  { key: "dnsimple", name: "DNSimple", statusUrl: "https://dnsimplestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "ns1", name: "NS1 (IBM)", statusUrl: "https://ns1.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "dnsmadeeasy", name: "DNS Made Easy", statusUrl: "https://dmestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "stackpath", name: "StackPath", statusUrl: "https://status.stackpath.com", parser: "statuspage_json", status: "operational" },
  { key: "edgecast", name: "Edgecast (Edgio)", statusUrl: "https://status.edgecast.com", parser: "statuspage_json", status: "operational" },
  { key: "section", name: "Section.io", statusUrl: "https://status.section.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // DEVELOPER TOOLS & CI/CD
  // ═══════════════════════════════════════════════════════════════
  { key: "buildkite", name: "Buildkite", statusUrl: "https://www.buildkitestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "semaphore", name: "Semaphore CI", statusUrl: "https://status.semaphoreci.com", parser: "statuspage_json", status: "operational" },
  { key: "gitkraken", name: "GitKraken", statusUrl: "https://www.gitkrakenstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "codecov", name: "Codecov", statusUrl: "https://codecov.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "bitrise", name: "Bitrise", statusUrl: "https://status.bitrise.io", parser: "statuspage_json", status: "operational" },
  { key: "codemagic", name: "Codemagic", statusUrl: "https://codemagic.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "codesandbox", name: "CodeSandbox", statusUrl: "https://status.codesandbox.io", parser: "statuspage_json", status: "operational" },
  { key: "codeclimate", name: "Code Climate", statusUrl: "https://status.codeclimate.com", parser: "statuspage_json", status: "operational" },
  { key: "harness", name: "Harness", statusUrl: "https://status.harness.io", parser: "statuspage_json", status: "operational" },
  { key: "sourcegraph", name: "Sourcegraph", statusUrl: "https://sourcegraph.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "buddy", name: "Buddy CI/CD", statusUrl: "https://buddy.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "depot", name: "Depot", statusUrl: "https://status.depot.dev", parser: "statuspage_json", status: "operational" },
  { key: "gitpod", name: "Gitpod", statusUrl: "https://www.gitpodstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "codacy", name: "Codacy", statusUrl: "https://status.codacy.com", parser: "statuspage_json", status: "operational" },
  { key: "saucelabs", name: "Sauce Labs", statusUrl: "https://status.saucelabs.com", parser: "statuspage_json", status: "operational" },
  { key: "browserstack", name: "BrowserStack", statusUrl: "https://status.browserstack.com", parser: "statuspage_json", status: "operational" },
  { key: "lambdatest", name: "LambdaTest", statusUrl: "https://status.lambdatest.com", parser: "statuspage_json", status: "operational" },
  { key: "netlify-cms", name: "Decap CMS", statusUrl: "https://decapcms.statuspage.io", parser: "statuspage_json", status: "operational" },

  // Package Registries
  { key: "pypi", name: "PyPI", statusUrl: "https://status.python.org", parser: "statuspage_json", status: "operational" },
  { key: "rubygems", name: "RubyGems", statusUrl: "https://status.rubygems.org", parser: "statuspage_json", status: "operational" },
  { key: "nuget", name: "NuGet", statusUrl: "https://status.nuget.org", parser: "statuspage_json", status: "operational" },
  { key: "crates-io", name: "Crates.io", statusUrl: "https://status.crates.io", parser: "statuspage_json", status: "operational" },
  { key: "packagist", name: "Packagist", statusUrl: "https://packagist.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // DATABASES & DATA PLATFORMS
  // ═══════════════════════════════════════════════════════════════
  { key: "fauna", name: "Fauna", statusUrl: "https://status.fauna.com", parser: "statuspage_json", status: "operational" },
  { key: "influxdata", name: "InfluxDB Cloud", statusUrl: "https://status.influxdata.com", parser: "statuspage_json", status: "operational" },
  { key: "aiven", name: "Aiven", statusUrl: "https://status.aiven.io", parser: "statuspage_json", status: "operational" },
  { key: "datastax", name: "DataStax Astra", statusUrl: "https://status.datastax.com", parser: "statuspage_json", status: "operational" },
  { key: "singlestore", name: "SingleStore", statusUrl: "https://status.singlestore.com", parser: "statuspage_json", status: "operational" },
  { key: "mariadb", name: "MariaDB SkySQL", statusUrl: "https://mariadb.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "couchbase", name: "Couchbase", statusUrl: "https://status.couchbase.com", parser: "statuspage_json", status: "operational" },
  { key: "timescale", name: "Timescale", statusUrl: "https://status.timescale.com", parser: "statuspage_json", status: "operational" },
  { key: "convex", name: "Convex", statusUrl: "https://status.convex.dev", parser: "statuspage_json", status: "operational" },
  { key: "turso", name: "Turso", statusUrl: "https://status.turso.tech", parser: "statuspage_json", status: "operational" },
  { key: "xata", name: "Xata", statusUrl: "https://status.xata.io", parser: "statuspage_json", status: "operational" },
  { key: "tigris", name: "Tigris Data", statusUrl: "https://status.tigrisdata.com", parser: "statuspage_json", status: "operational" },
  { key: "neo4j", name: "Neo4j Aura", statusUrl: "https://status.neo4j.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // COMMUNICATION & MESSAGING
  // ═══════════════════════════════════════════════════════════════
  { key: "vonage", name: "Vonage", statusUrl: "https://vonageapi.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "bandwidth", name: "Bandwidth", statusUrl: "https://status.bandwidth.com", parser: "statuspage_json", status: "operational" },
  { key: "plivo", name: "Plivo", statusUrl: "https://status.plivo.com", parser: "statuspage_json", status: "operational" },
  { key: "telnyx", name: "Telnyx", statusUrl: "https://status.telnyx.com", parser: "statuspage_json", status: "operational" },
  { key: "messagebird", name: "MessageBird", statusUrl: "https://status.messagebird.com", parser: "statuspage_json", status: "operational" },
  { key: "ringcentral", name: "RingCentral", statusUrl: "https://status.ringcentral.com", parser: "statuspage_json", status: "operational" },
  { key: "8x8", name: "8x8", statusUrl: "https://status.8x8.com", parser: "statuspage_json", status: "operational" },
  { key: "dialpad", name: "Dialpad", statusUrl: "https://status.dialpad.com", parser: "statuspage_json", status: "operational" },
  { key: "genesys", name: "Genesys Cloud", statusUrl: "https://status.mypurecloud.com", parser: "statuspage_json", status: "operational" },
  { key: "pubnub", name: "PubNub", statusUrl: "https://status.pubnub.com", parser: "statuspage_json", status: "operational" },
  { key: "pusher", name: "Pusher", statusUrl: "https://status.pusher.com", parser: "statuspage_json", status: "operational" },
  { key: "ably", name: "Ably", statusUrl: "https://status.ably.com", parser: "statuspage_json", status: "operational" },
  { key: "getstream", name: "Stream", statusUrl: "https://status.getstream.io", parser: "statuspage_json", status: "operational" },
  { key: "sendbird", name: "Sendbird", statusUrl: "https://status.sendbird.com", parser: "statuspage_json", status: "operational" },
  { key: "sinch", name: "Sinch", statusUrl: "https://status.sinch.com", parser: "statuspage_json", status: "operational" },
  { key: "infobip", name: "Infobip", statusUrl: "https://status.infobip.com", parser: "statuspage_json", status: "operational" },
  { key: "twitch", name: "Twitch", statusUrl: "https://status.twitch.tv", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // CRM & SALES
  // ═══════════════════════════════════════════════════════════════
  { key: "close", name: "Close CRM", statusUrl: "https://close.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "copper", name: "Copper CRM", statusUrl: "https://status.copper.com", parser: "statuspage_json", status: "operational" },
  { key: "apollo", name: "Apollo.io", statusUrl: "https://status.apollo.io", parser: "statuspage_json", status: "operational" },
  { key: "outreach", name: "Outreach", statusUrl: "https://status.outreach.io", parser: "statuspage_json", status: "operational" },
  { key: "salesloft", name: "SalesLoft", statusUrl: "https://status.salesloft.com", parser: "statuspage_json", status: "operational" },
  { key: "gong", name: "Gong", statusUrl: "https://status.gong.io", parser: "statuspage_json", status: "operational" },
  { key: "chorus", name: "Chorus.ai (ZoomInfo)", statusUrl: "https://status.chorus.ai", parser: "statuspage_json", status: "operational" },
  { key: "clearbit", name: "Clearbit", statusUrl: "https://status.clearbit.com", parser: "statuspage_json", status: "operational" },
  { key: "zoominfo", name: "ZoomInfo", statusUrl: "https://status.zoominfo.com", parser: "statuspage_json", status: "operational" },
  { key: "highspot", name: "Highspot", statusUrl: "https://status.highspot.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // EMAIL MARKETING & MARKETING TOOLS
  // ═══════════════════════════════════════════════════════════════
  { key: "brevo", name: "Brevo (Sendinblue)", statusUrl: "https://status.brevo.com", parser: "statuspage_json", status: "operational" },
  { key: "convertkit", name: "ConvertKit", statusUrl: "https://status.convertkit.com", parser: "statuspage_json", status: "operational" },
  { key: "customerio", name: "Customer.io", statusUrl: "https://status.customer.io", parser: "statuspage_json", status: "operational" },
  { key: "iterable", name: "Iterable", statusUrl: "https://status.iterable.com", parser: "statuspage_json", status: "operational" },
  { key: "mailjet", name: "Mailjet", statusUrl: "https://status.mailjet.com", parser: "statuspage_json", status: "operational" },
  { key: "sparkpost", name: "SparkPost", statusUrl: "https://status.sparkpost.com", parser: "statuspage_json", status: "operational" },
  { key: "campaignmonitor", name: "Campaign Monitor", statusUrl: "https://status.campaignmonitor.com", parser: "statuspage_json", status: "operational" },
  { key: "drip", name: "Drip", statusUrl: "https://status.drip.com", parser: "statuspage_json", status: "operational" },
  { key: "omnisend", name: "Omnisend", statusUrl: "https://status.omnisend.com", parser: "statuspage_json", status: "operational" },
  { key: "hotjar", name: "Hotjar", statusUrl: "https://status.hotjar.com", parser: "statuspage_json", status: "operational" },
  { key: "fullstory", name: "FullStory", statusUrl: "https://status.fullstory.com", parser: "statuspage_json", status: "operational" },
  { key: "optimizely", name: "Optimizely", statusUrl: "https://status.optimizely.com", parser: "statuspage_json", status: "operational" },
  { key: "unbounce", name: "Unbounce", statusUrl: "https://status.unbounce.com", parser: "statuspage_json", status: "operational" },
  { key: "instapage", name: "Instapage", statusUrl: "https://instapage.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "heap", name: "Heap Analytics", statusUrl: "https://heapstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "posthog", name: "PostHog", statusUrl: "https://status.posthog.com", parser: "statuspage_json", status: "operational" },
  { key: "rudderstack", name: "RudderStack", statusUrl: "https://status.rudderstack.com", parser: "statuspage_json", status: "operational" },
  { key: "mparticle", name: "mParticle", statusUrl: "https://status.mparticle.com", parser: "statuspage_json", status: "operational" },
  { key: "appsflyer", name: "AppsFlyer", statusUrl: "https://status.appsflyer.com", parser: "statuspage_json", status: "operational" },
  { key: "adjust", name: "Adjust", statusUrl: "https://status.adjust.com", parser: "statuspage_json", status: "operational" },
  { key: "branch", name: "Branch", statusUrl: "https://status.branch.io", parser: "statuspage_json", status: "operational" },
  { key: "onesignal", name: "OneSignal", statusUrl: "https://onesignal.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "leanplum", name: "Leanplum", statusUrl: "https://status.leanplum.com", parser: "statuspage_json", status: "operational" },
  { key: "braze", name: "Braze", statusUrl: "https://status.braze.com", parser: "statuspage_json", status: "operational" },
  { key: "segment-cdp", name: "Twilio Segment", statusUrl: "https://status.segment.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════
  { key: "fortinet", name: "Fortinet Cloud", statusUrl: "https://status.forticloud.com", parser: "statuspage_json", status: "operational" },
  { key: "proofpoint", name: "Proofpoint", statusUrl: "https://status.proofpoint.com", parser: "statuspage_json", status: "operational" },
  { key: "mimecast", name: "Mimecast", statusUrl: "https://status.mimecast.com", parser: "statuspage_json", status: "operational" },
  { key: "knowbe4", name: "KnowBe4", statusUrl: "https://status.knowbe4.com", parser: "statuspage_json", status: "operational" },
  { key: "rapid7", name: "Rapid7", statusUrl: "https://status.rapid7.com", parser: "statuspage_json", status: "operational" },
  { key: "tenable", name: "Tenable", statusUrl: "https://status.tenable.com", parser: "statuspage_json", status: "operational" },
  { key: "qualys", name: "Qualys", statusUrl: "https://status.qualys.com", parser: "statuspage_json", status: "operational" },
  { key: "imperva", name: "Imperva", statusUrl: "https://status.imperva.com", parser: "statuspage_json", status: "operational" },
  { key: "zscaler", name: "Zscaler", statusUrl: "https://trust.zscaler.com", parser: "generic_html", status: "operational" },
  { key: "malwarebytes", name: "Malwarebytes", statusUrl: "https://status.malwarebytes.com", parser: "statuspage_json", status: "operational" },
  { key: "1passwordbiz", name: "1Password Business", statusUrl: "https://1password.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "keeper", name: "Keeper Security", statusUrl: "https://statuspage.keeper.io", parser: "statuspage_json", status: "operational" },
  { key: "dashlane", name: "Dashlane", statusUrl: "https://status.dashlane.com", parser: "statuspage_json", status: "operational" },
  { key: "nordpass", name: "NordPass", statusUrl: "https://status.nordpass.com", parser: "statuspage_json", status: "operational" },
  { key: "nordvpn", name: "NordVPN", statusUrl: "https://status.nordvpn.com", parser: "statuspage_json", status: "operational" },
  { key: "norton", name: "Norton", statusUrl: "https://status.norton.com", parser: "generic_html", status: "operational" },
  { key: "carbonblack", name: "Carbon Black (VMware)", statusUrl: "https://status.carbonblack.com", parser: "statuspage_json", status: "operational" },
  { key: "lacework", name: "Lacework", statusUrl: "https://status.lacework.com", parser: "statuspage_json", status: "operational" },
  { key: "wiz", name: "Wiz", statusUrl: "https://status.wiz.io", parser: "statuspage_json", status: "operational" },
  { key: "orca-security", name: "Orca Security", statusUrl: "https://status.orca.security", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // IDENTITY & ACCESS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  { key: "onelogin", name: "OneLogin", statusUrl: "https://status.onelogin.com", parser: "statuspage_json", status: "operational" },
  { key: "jumpcloud", name: "JumpCloud", statusUrl: "https://status.jumpcloud.com", parser: "statuspage_json", status: "operational" },
  { key: "cyberark", name: "CyberArk", statusUrl: "https://status.cyberark.com", parser: "statuspage_json", status: "operational" },
  { key: "beyondtrust", name: "BeyondTrust", statusUrl: "https://status.beyondtrust.com", parser: "statuspage_json", status: "operational" },
  { key: "sailpoint", name: "SailPoint", statusUrl: "https://status.sailpoint.com", parser: "statuspage_json", status: "operational" },
  { key: "clerk", name: "Clerk", statusUrl: "https://status.clerk.com", parser: "statuspage_json", status: "operational" },
  { key: "stytch", name: "Stytch", statusUrl: "https://status.stytch.com", parser: "statuspage_json", status: "operational" },
  { key: "workos", name: "WorkOS", statusUrl: "https://status.workos.com", parser: "statuspage_json", status: "operational" },
  { key: "fusionauth", name: "FusionAuth", statusUrl: "https://status.fusionauth.io", parser: "statuspage_json", status: "operational" },
  { key: "descope", name: "Descope", statusUrl: "https://status.descope.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & FINTECH
  // ═══════════════════════════════════════════════════════════════
  { key: "adyen", name: "Adyen", statusUrl: "https://status.adyen.com", parser: "statuspage_json", status: "operational" },
  { key: "mollie", name: "Mollie", statusUrl: "https://status.mollie.com", parser: "statuspage_json", status: "operational" },
  { key: "gocardless", name: "GoCardless", statusUrl: "https://www.gocardlessstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "chargebee", name: "Chargebee", statusUrl: "https://status.chargebee.com", parser: "statuspage_json", status: "operational" },
  { key: "recurly", name: "Recurly", statusUrl: "https://status.recurly.com", parser: "statuspage_json", status: "operational" },
  { key: "paddle", name: "Paddle", statusUrl: "https://status.paddle.com", parser: "statuspage_json", status: "operational" },
  { key: "dwolla", name: "Dwolla", statusUrl: "https://status.dwolla.com", parser: "statuspage_json", status: "operational" },
  { key: "marqeta", name: "Marqeta", statusUrl: "https://status.marqeta.com", parser: "statuspage_json", status: "operational" },
  { key: "wise", name: "Wise", statusUrl: "https://status.wise.com", parser: "statuspage_json", status: "operational" },
  { key: "circle-pay", name: "Circle", statusUrl: "https://status.circle.com", parser: "statuspage_json", status: "operational" },
  { key: "alchemy", name: "Alchemy", statusUrl: "https://status.alchemy.com", parser: "statuspage_json", status: "operational" },
  { key: "infura", name: "Infura", statusUrl: "https://status.infura.io", parser: "statuspage_json", status: "operational" },
  { key: "quicknode", name: "QuickNode", statusUrl: "https://status.quicknode.com", parser: "statuspage_json", status: "operational" },
  { key: "checkout-com", name: "Checkout.com", statusUrl: "https://status.checkout.com", parser: "statuspage_json", status: "operational" },
  { key: "affirm", name: "Affirm", statusUrl: "https://status.affirm.com", parser: "statuspage_json", status: "operational" },
  { key: "klarna", name: "Klarna", statusUrl: "https://status.klarna.com", parser: "statuspage_json", status: "operational" },
  { key: "razorpay", name: "Razorpay", statusUrl: "https://status.razorpay.com", parser: "statuspage_json", status: "operational" },
  { key: "flutterwave", name: "Flutterwave", statusUrl: "https://status.flutterwave.com", parser: "statuspage_json", status: "operational" },
  { key: "paystack", name: "Paystack", statusUrl: "https://status.paystack.com", parser: "statuspage_json", status: "operational" },
  { key: "chargify", name: "Maxio (Chargify)", statusUrl: "https://status.chargify.com", parser: "statuspage_json", status: "operational" },
  { key: "lemonsqueezy", name: "Lemon Squeezy", statusUrl: "https://status.lemonsqueezy.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // E-COMMERCE & SHIPPING
  // ═══════════════════════════════════════════════════════════════
  { key: "squarespace", name: "Squarespace", statusUrl: "https://status.squarespace.com", parser: "statuspage_json", status: "operational" },
  { key: "shippo", name: "Shippo", statusUrl: "https://status.goshippo.com", parser: "statuspage_json", status: "operational" },
  { key: "shipstation", name: "ShipStation", statusUrl: "https://status.shipstation.com", parser: "statuspage_json", status: "operational" },
  { key: "easypost", name: "EasyPost", statusUrl: "https://www.easypoststatus.com", parser: "statuspage_json", status: "operational" },
  { key: "yotpo", name: "Yotpo", statusUrl: "https://status.yotpo.com", parser: "statuspage_json", status: "operational" },
  { key: "recharge", name: "Recharge", statusUrl: "https://status.rechargepayments.com", parser: "statuspage_json", status: "operational" },
  { key: "gorgias", name: "Gorgias", statusUrl: "https://status.gorgias.com", parser: "statuspage_json", status: "operational" },
  { key: "klaviyo-ecom", name: "Klaviyo Ecommerce", statusUrl: "https://status.klaviyo.com", parser: "statuspage_json", status: "operational" },
  { key: "stamped", name: "Stamped.io", statusUrl: "https://stamped.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "bolt-checkout", name: "Bolt Checkout", statusUrl: "https://status.bolt.com", parser: "statuspage_json", status: "operational" },
  { key: "swell", name: "Swell Commerce", statusUrl: "https://status.swell.is", parser: "statuspage_json", status: "operational" },
  { key: "commercetools", name: "commercetools", statusUrl: "https://status.commercetools.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // EDUCATION & LMS
  // ═══════════════════════════════════════════════════════════════
  { key: "instructure", name: "Canvas LMS (Instructure)", statusUrl: "https://status.instructure.com", parser: "statuspage_json", status: "operational" },
  { key: "turnitin", name: "Turnitin", statusUrl: "https://turnitin.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "schoology", name: "Schoology", statusUrl: "https://status.schoology.com", parser: "statuspage_json", status: "operational" },
  { key: "blackboard", name: "Blackboard", statusUrl: "https://status.blackboard.com", parser: "statuspage_json", status: "operational" },
  { key: "d2l", name: "D2L Brightspace", statusUrl: "https://status.d2l.com", parser: "statuspage_json", status: "operational" },
  { key: "kahoot", name: "Kahoot!", statusUrl: "https://status.kahoot.com", parser: "statuspage_json", status: "operational" },
  { key: "quizlet", name: "Quizlet", statusUrl: "https://quizlet.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "thinkific", name: "Thinkific", statusUrl: "https://status.thinkific.com", parser: "statuspage_json", status: "operational" },
  { key: "teachable", name: "Teachable", statusUrl: "https://status.teachable.com", parser: "statuspage_json", status: "operational" },
  { key: "kajabi", name: "Kajabi", statusUrl: "https://status.kajabi.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // HR & RECRUITING & PAYROLL
  // ═══════════════════════════════════════════════════════════════
  { key: "bamboohr", name: "BambooHR", statusUrl: "https://status.bamboohr.com", parser: "statuspage_json", status: "operational" },
  { key: "gusto", name: "Gusto", statusUrl: "https://status.gusto.com", parser: "statuspage_json", status: "operational" },
  { key: "rippling", name: "Rippling", statusUrl: "https://status.rippling.com", parser: "statuspage_json", status: "operational" },
  { key: "greenhouse", name: "Greenhouse", statusUrl: "https://status.greenhouse.io", parser: "statuspage_json", status: "operational" },
  { key: "lever", name: "Lever", statusUrl: "https://status.lever.co", parser: "statuspage_json", status: "operational" },
  { key: "lattice", name: "Lattice", statusUrl: "https://status.lattice.com", parser: "statuspage_json", status: "operational" },
  { key: "namely", name: "Namely", statusUrl: "https://status.namely.com", parser: "statuspage_json", status: "operational" },
  { key: "deel", name: "Deel", statusUrl: "https://status.deel.com", parser: "statuspage_json", status: "operational" },
  { key: "workday", name: "Workday", statusUrl: "https://status.workday.com", parser: "generic_html", status: "operational" },
  { key: "adp", name: "ADP", statusUrl: "https://status.adp.com", parser: "generic_html", status: "operational" },
  { key: "paychex", name: "Paychex", statusUrl: "https://status.paychex.com", parser: "statuspage_json", status: "operational" },
  { key: "justworks", name: "Justworks", statusUrl: "https://status.justworks.com", parser: "statuspage_json", status: "operational" },
  { key: "bob-hr", name: "HiBob", statusUrl: "https://status.hibob.com", parser: "statuspage_json", status: "operational" },
  { key: "personio", name: "Personio", statusUrl: "https://status.personio.com", parser: "statuspage_json", status: "operational" },
  { key: "ashby", name: "Ashby", statusUrl: "https://status.ashbyhq.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // DESIGN & CREATIVE TOOLS
  // ═══════════════════════════════════════════════════════════════
  { key: "invision", name: "InVision", statusUrl: "https://status.invisionapp.com", parser: "statuspage_json", status: "operational" },
  { key: "sketch", name: "Sketch", statusUrl: "https://status.sketch.com", parser: "statuspage_json", status: "operational" },
  { key: "zeplin", name: "Zeplin", statusUrl: "https://status.zeplin.io", parser: "statuspage_json", status: "operational" },
  { key: "framer", name: "Framer", statusUrl: "https://status.framer.com", parser: "statuspage_json", status: "operational" },
  { key: "vimeo", name: "Vimeo", statusUrl: "https://www.vimeostatus.com", parser: "statuspage_json", status: "operational" },
  { key: "imgix", name: "imgix", statusUrl: "https://status.imgix.com", parser: "statuspage_json", status: "operational" },
  { key: "lucidchart", name: "Lucid", statusUrl: "https://status.lucid.co", parser: "statuspage_json", status: "operational" },
  { key: "mural", name: "Mural", statusUrl: "https://status.mural.co", parser: "statuspage_json", status: "operational" },
  { key: "pitch", name: "Pitch", statusUrl: "https://status.pitch.com", parser: "statuspage_json", status: "operational" },
  { key: "lottiefiles", name: "LottieFiles", statusUrl: "https://status.lottiefiles.com", parser: "statuspage_json", status: "operational" },
  { key: "shutterstock", name: "Shutterstock", statusUrl: "https://status.shutterstock.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // PROJECT MANAGEMENT & COLLABORATION
  // ═══════════════════════════════════════════════════════════════
  { key: "clickup", name: "ClickUp", statusUrl: "https://clickup.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "wrike", name: "Wrike", statusUrl: "https://status.wrike.com", parser: "statuspage_json", status: "operational" },
  { key: "smartsheet", name: "Smartsheet", statusUrl: "https://status.smartsheet.com", parser: "statuspage_json", status: "operational" },
  { key: "teamwork", name: "Teamwork", statusUrl: "https://www.teamworkstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "shortcut", name: "Shortcut", statusUrl: "https://status.shortcut.com", parser: "statuspage_json", status: "operational" },
  { key: "basecamp", name: "Basecamp", statusUrl: "https://basecamp.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "height", name: "Height", statusUrl: "https://status.height.app", parser: "statuspage_json", status: "operational" },
  { key: "hive", name: "Hive", statusUrl: "https://status.hive.com", parser: "statuspage_json", status: "operational" },
  { key: "productboard", name: "Productboard", statusUrl: "https://status.productboard.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER SUPPORT & HELPDESK
  // ═══════════════════════════════════════════════════════════════
  { key: "helpscout", name: "Help Scout", statusUrl: "https://status.helpscout.com", parser: "statuspage_json", status: "operational" },
  { key: "front", name: "Front", statusUrl: "https://status.front.com", parser: "statuspage_json", status: "operational" },
  { key: "drift", name: "Drift", statusUrl: "https://status.drift.com", parser: "statuspage_json", status: "operational" },
  { key: "livechat", name: "LiveChat", statusUrl: "https://status.livechat.com", parser: "statuspage_json", status: "operational" },
  { key: "crisp", name: "Crisp", statusUrl: "https://status.crisp.chat", parser: "statuspage_json", status: "operational" },
  { key: "kustomer", name: "Kustomer", statusUrl: "https://status.kustomer.com", parser: "statuspage_json", status: "operational" },
  { key: "gladly", name: "Gladly", statusUrl: "https://status.gladly.com", parser: "statuspage_json", status: "operational" },
  { key: "dixa", name: "Dixa", statusUrl: "https://status.dixa.com", parser: "statuspage_json", status: "operational" },
  { key: "kayako", name: "Kayako", statusUrl: "https://status.kayako.com", parser: "statuspage_json", status: "operational" },
  { key: "talkdesk", name: "Talkdesk", statusUrl: "https://status.talkdesk.com", parser: "statuspage_json", status: "operational" },
  { key: "five9", name: "Five9", statusUrl: "https://status.five9.com", parser: "statuspage_json", status: "operational" },
  { key: "aircall", name: "Aircall", statusUrl: "https://status.aircall.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // AI & ML PLATFORMS
  // ═══════════════════════════════════════════════════════════════
  { key: "cohere", name: "Cohere", statusUrl: "https://status.cohere.com", parser: "statuspage_json", status: "operational" },
  { key: "replicate", name: "Replicate", statusUrl: "https://status.replicate.com", parser: "statuspage_json", status: "operational" },
  { key: "huggingface", name: "Hugging Face", statusUrl: "https://status.huggingface.co", parser: "statuspage_json", status: "operational" },
  { key: "stabilityai", name: "Stability AI", statusUrl: "https://status.stability.ai", parser: "statuspage_json", status: "operational" },
  { key: "wandb", name: "Weights & Biases", statusUrl: "https://status.wandb.ai", parser: "statuspage_json", status: "operational" },
  { key: "scale", name: "Scale AI", statusUrl: "https://status.scale.com", parser: "statuspage_json", status: "operational" },
  { key: "pinecone", name: "Pinecone", statusUrl: "https://status.pinecone.io", parser: "statuspage_json", status: "operational" },
  { key: "weaviate", name: "Weaviate", statusUrl: "https://status.weaviate.io", parser: "statuspage_json", status: "operational" },
  { key: "qdrant", name: "Qdrant", statusUrl: "https://status.qdrant.io", parser: "statuspage_json", status: "operational" },
  { key: "deepl", name: "DeepL", statusUrl: "https://status.deepl.com", parser: "statuspage_json", status: "operational" },
  { key: "assemblyai", name: "AssemblyAI", statusUrl: "https://status.assemblyai.com", parser: "statuspage_json", status: "operational" },
  { key: "elevenlabs", name: "ElevenLabs", statusUrl: "https://status.elevenlabs.io", parser: "statuspage_json", status: "operational" },
  { key: "perplexity", name: "Perplexity", statusUrl: "https://status.perplexity.ai", parser: "statuspage_json", status: "operational" },
  { key: "together", name: "Together AI", statusUrl: "https://status.together.ai", parser: "statuspage_json", status: "operational" },
  { key: "anyscale", name: "Anyscale", statusUrl: "https://status.anyscale.com", parser: "statuspage_json", status: "operational" },
  { key: "modal", name: "Modal", statusUrl: "https://status.modal.com", parser: "statuspage_json", status: "operational" },
  { key: "groq", name: "Groq", statusUrl: "https://status.groq.com", parser: "statuspage_json", status: "operational" },
  { key: "fireworks-ai", name: "Fireworks AI", statusUrl: "https://status.fireworks.ai", parser: "statuspage_json", status: "operational" },
  { key: "roboflow", name: "Roboflow", statusUrl: "https://status.roboflow.com", parser: "statuspage_json", status: "operational" },
  { key: "clarifai", name: "Clarifai", statusUrl: "https://status.clarifai.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // OBSERVABILITY & MONITORING
  // ═══════════════════════════════════════════════════════════════
  { key: "splunk", name: "Splunk Cloud", statusUrl: "https://www.splunkstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "dynatrace", name: "Dynatrace", statusUrl: "https://status.dynatrace.com", parser: "statuspage_json", status: "operational" },
  { key: "honeycomb", name: "Honeycomb", statusUrl: "https://status.honeycomb.io", parser: "statuspage_json", status: "operational" },
  { key: "loggly", name: "Loggly", statusUrl: "https://status.loggly.com", parser: "statuspage_json", status: "operational" },
  { key: "papertrail", name: "Papertrail", statusUrl: "https://www.papertrailstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "logdna", name: "Mezmo (LogDNA)", statusUrl: "https://status.mezmo.com", parser: "statuspage_json", status: "operational" },
  { key: "opsgenie", name: "Opsgenie", statusUrl: "https://opsgenie.status.atlassian.com", parser: "statuspage_json", status: "operational" },
  { key: "xmatters", name: "xMatters", statusUrl: "https://status.xmatters.com", parser: "statuspage_json", status: "operational" },
  { key: "checkly", name: "Checkly", statusUrl: "https://status.checklyhq.com", parser: "statuspage_json", status: "operational" },
  { key: "statuspage", name: "Statuspage", statusUrl: "https://metastatuspage.com", parser: "statuspage_json", status: "operational" },
  { key: "betteruptime", name: "Better Uptime", statusUrl: "https://betteruptime.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "logz-io", name: "Logz.io", statusUrl: "https://status.logz.io", parser: "statuspage_json", status: "operational" },
  { key: "lightstep", name: "Lightstep (ServiceNow)", statusUrl: "https://lightstep.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "chronosphere", name: "Chronosphere", statusUrl: "https://status.chronosphere.io", parser: "statuspage_json", status: "operational" },
  { key: "coralogix", name: "Coralogix", statusUrl: "https://status.coralogix.com", parser: "statuspage_json", status: "operational" },
  { key: "sumo-logic", name: "Sumo Logic", statusUrl: "https://status.sumologic.com", parser: "statuspage_json", status: "operational" },
  { key: "kentik", name: "Kentik", statusUrl: "https://status.kentik.com", parser: "statuspage_json", status: "operational" },
  { key: "site24x7", name: "Site24x7", statusUrl: "https://status.site24x7.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // AUTOMATION & iPaaS
  // ═══════════════════════════════════════════════════════════════
  { key: "zapier", name: "Zapier", statusUrl: "https://status.zapier.com", parser: "statuspage_json", status: "operational" },
  { key: "make", name: "Make (Integromat)", statusUrl: "https://status.make.com", parser: "statuspage_json", status: "operational" },
  { key: "workato", name: "Workato", statusUrl: "https://status.workato.com", parser: "statuspage_json", status: "operational" },
  { key: "pipedream", name: "Pipedream", statusUrl: "https://status.pipedream.com", parser: "statuspage_json", status: "operational" },
  { key: "tray-io", name: "Tray.io", statusUrl: "https://status.tray.io", parser: "statuspage_json", status: "operational" },
  { key: "celigo", name: "Celigo", statusUrl: "https://status.celigo.com", parser: "statuspage_json", status: "operational" },
  { key: "boomi", name: "Boomi", statusUrl: "https://status.boomi.com", parser: "statuspage_json", status: "operational" },
  { key: "snaplogic", name: "SnapLogic", statusUrl: "https://status.snaplogic.com", parser: "statuspage_json", status: "operational" },
  { key: "ifttt", name: "IFTTT", statusUrl: "https://status.ifttt.com", parser: "statuspage_json", status: "operational" },
  { key: "n8n-cloud", name: "n8n Cloud", statusUrl: "https://status.n8n.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // VIDEO & STREAMING
  // ═══════════════════════════════════════════════════════════════
  { key: "mux", name: "Mux", statusUrl: "https://status.mux.com", parser: "statuspage_json", status: "operational" },
  { key: "wistia", name: "Wistia", statusUrl: "https://status.wistia.com", parser: "statuspage_json", status: "operational" },
  { key: "brightcove", name: "Brightcove", statusUrl: "https://status.brightcove.com", parser: "statuspage_json", status: "operational" },
  { key: "jwplayer", name: "JW Player", statusUrl: "https://status.jwplayer.com", parser: "statuspage_json", status: "operational" },
  { key: "agora", name: "Agora", statusUrl: "https://status.agora.io", parser: "statuspage_json", status: "operational" },
  { key: "daily", name: "Daily.co", statusUrl: "https://status.daily.co", parser: "statuspage_json", status: "operational" },
  { key: "vidyard", name: "Vidyard", statusUrl: "https://status.vidyard.com", parser: "statuspage_json", status: "operational" },
  { key: "cloudflare-stream", name: "Cloudflare Stream", statusUrl: "https://www.cloudflarestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "livestorm", name: "Livestorm", statusUrl: "https://status.livestorm.co", parser: "statuspage_json", status: "operational" },
  { key: "whereby", name: "Whereby", statusUrl: "https://status.whereby.com", parser: "statuspage_json", status: "operational" },
  { key: "100ms", name: "100ms", statusUrl: "https://status.100ms.live", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // STORAGE & BACKUP
  // ═══════════════════════════════════════════════════════════════
  { key: "wasabi", name: "Wasabi", statusUrl: "https://status.wasabi.com", parser: "statuspage_json", status: "operational" },
  { key: "crashplan", name: "CrashPlan", statusUrl: "https://status.crashplan.com", parser: "statuspage_json", status: "operational" },
  { key: "acronis", name: "Acronis", statusUrl: "https://status.acronis.com", parser: "statuspage_json", status: "operational" },
  { key: "druva", name: "Druva", statusUrl: "https://status.druva.com", parser: "statuspage_json", status: "operational" },
  { key: "commvault", name: "Commvault", statusUrl: "https://status.commvault.com", parser: "statuspage_json", status: "operational" },
  { key: "tresorit", name: "Tresorit", statusUrl: "https://status.tresorit.com", parser: "statuspage_json", status: "operational" },
  { key: "egnyte", name: "Egnyte", statusUrl: "https://status.egnyte.com", parser: "statuspage_json", status: "operational" },
  { key: "filestack", name: "Filestack", statusUrl: "https://status.filestack.com", parser: "statuspage_json", status: "operational" },
  { key: "uploadcare", name: "Uploadcare", statusUrl: "https://status.uploadcare.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTIVITY & OFFICE
  // ═══════════════════════════════════════════════════════════════
  { key: "coda", name: "Coda", statusUrl: "https://status.coda.io", parser: "statuspage_json", status: "operational" },
  { key: "clockify", name: "Clockify", statusUrl: "https://status.clockify.me", parser: "statuspage_json", status: "operational" },
  { key: "toggl", name: "Toggl", statusUrl: "https://status.toggl.com", parser: "statuspage_json", status: "operational" },
  { key: "harvest", name: "Harvest", statusUrl: "https://www.harveststatus.com", parser: "statuspage_json", status: "operational" },
  { key: "xero", name: "Xero", statusUrl: "https://status.xero.com", parser: "statuspage_json", status: "operational" },
  { key: "1password-teams", name: "1Password Teams", statusUrl: "https://status.1password.com", parser: "statuspage_json", status: "operational" },
  { key: "evernote", name: "Evernote", statusUrl: "https://status.evernote.com", parser: "statuspage_json", status: "operational" },
  { key: "grammarly", name: "Grammarly", statusUrl: "https://status.grammarly.com", parser: "statuspage_json", status: "operational" },
  { key: "typeform", name: "Typeform", statusUrl: "https://status.typeform.com", parser: "statuspage_json", status: "operational" },
  { key: "surveymonkey", name: "SurveyMonkey", statusUrl: "https://status.surveymonkey.com", parser: "statuspage_json", status: "operational" },
  { key: "calendly-biz", name: "Calendly Business", statusUrl: "https://status.calendly.com", parser: "statuspage_json", status: "operational" },
  { key: "doodle", name: "Doodle", statusUrl: "https://status.doodle.com", parser: "statuspage_json", status: "operational" },
  { key: "pandadoc", name: "PandaDoc", statusUrl: "https://status.pandadoc.com", parser: "statuspage_json", status: "operational" },
  { key: "hellosign", name: "HelloSign (Dropbox Sign)", statusUrl: "https://status.hellosign.com", parser: "statuspage_json", status: "operational" },
  { key: "annoto", name: "Annoto", statusUrl: "https://annoto.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // GAMING & GAME SERVICES
  // ═══════════════════════════════════════════════════════════════
  { key: "epicgames", name: "Epic Games", statusUrl: "https://status.epicgames.com", parser: "statuspage_json", status: "operational" },
  { key: "unity", name: "Unity", statusUrl: "https://status.unity.com", parser: "statuspage_json", status: "operational" },
  { key: "unrealengine", name: "Unreal Engine", statusUrl: "https://status.epicgames.com", parser: "statuspage_json", status: "operational" },
  { key: "playfab", name: "PlayFab (Azure)", statusUrl: "https://status.playfab.com", parser: "statuspage_json", status: "operational" },
  { key: "photon", name: "Photon Engine", statusUrl: "https://status.photonengine.com", parser: "statuspage_json", status: "operational" },
  { key: "gamesparks", name: "GameSparks", statusUrl: "https://gamesparks.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // NETWORKING & VPN
  // ═══════════════════════════════════════════════════════════════
  { key: "tailscale", name: "Tailscale", statusUrl: "https://status.tailscale.com", parser: "statuspage_json", status: "operational" },
  { key: "meraki", name: "Cisco Meraki", statusUrl: "https://status.meraki.com", parser: "statuspage_json", status: "operational" },
  { key: "ubiquiti", name: "Ubiquiti", statusUrl: "https://status.ui.com", parser: "statuspage_json", status: "operational" },
  { key: "expressvpn", name: "ExpressVPN", statusUrl: "https://www.expressvpn.com/status", parser: "generic_html", status: "operational" },
  { key: "mullvad", name: "Mullvad VPN", statusUrl: "https://status.mullvad.net", parser: "statuspage_json", status: "operational" },
  { key: "zerotier", name: "ZeroTier", statusUrl: "https://status.zerotier.com", parser: "statuspage_json", status: "operational" },
  { key: "netbird", name: "NetBird", statusUrl: "https://status.netbird.io", parser: "statuspage_json", status: "operational" },
  { key: "cato-networks", name: "Cato Networks", statusUrl: "https://status.catonetworks.com", parser: "statuspage_json", status: "operational" },
  { key: "arista", name: "Arista CloudVision", statusUrl: "https://status.arista.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // LEGAL & COMPLIANCE
  // ═══════════════════════════════════════════════════════════════
  { key: "ironclad", name: "Ironclad", statusUrl: "https://status.ironcladapp.com", parser: "statuspage_json", status: "operational" },
  { key: "docuseal", name: "DocuSeal", statusUrl: "https://status.docuseal.co", parser: "statuspage_json", status: "operational" },
  { key: "clio", name: "Clio", statusUrl: "https://status.clio.com", parser: "statuspage_json", status: "operational" },
  { key: "contractbook", name: "Contractbook", statusUrl: "https://status.contractbook.com", parser: "statuspage_json", status: "operational" },
  { key: "vanta", name: "Vanta", statusUrl: "https://status.vanta.com", parser: "statuspage_json", status: "operational" },
  { key: "drata", name: "Drata", statusUrl: "https://status.drata.com", parser: "statuspage_json", status: "operational" },
  { key: "secureframe", name: "Secureframe", statusUrl: "https://status.secureframe.com", parser: "statuspage_json", status: "operational" },
  { key: "onetrust", name: "OneTrust", statusUrl: "https://status.onetrust.com", parser: "statuspage_json", status: "operational" },
  { key: "termly", name: "Termly", statusUrl: "https://status.termly.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // HEALTHCARE & HEALTH IT
  // ═══════════════════════════════════════════════════════════════
  { key: "epic-systems", name: "Epic Systems", statusUrl: "https://status.epic.com", parser: "generic_html", status: "operational" },
  { key: "veradigm", name: "Veradigm (Allscripts)", statusUrl: "https://status.veradigm.com", parser: "statuspage_json", status: "operational" },
  { key: "doxy", name: "Doxy.me", statusUrl: "https://status.doxy.me", parser: "statuspage_json", status: "operational" },
  { key: "healthie", name: "Healthie", statusUrl: "https://status.gethealthie.com", parser: "statuspage_json", status: "operational" },
  { key: "simplepractice", name: "SimplePractice", statusUrl: "https://status.simplepractice.com", parser: "statuspage_json", status: "operational" },
  { key: "elation", name: "Elation Health", statusUrl: "https://status.elationhealth.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // IoT & HARDWARE PLATFORMS
  // ═══════════════════════════════════════════════════════════════
  { key: "particle", name: "Particle IoT", statusUrl: "https://status.particle.io", parser: "statuspage_json", status: "operational" },
  { key: "arduino-cloud", name: "Arduino Cloud", statusUrl: "https://status.arduino.cc", parser: "statuspage_json", status: "operational" },
  { key: "losant", name: "Losant", statusUrl: "https://status.losant.com", parser: "statuspage_json", status: "operational" },
  { key: "hologram", name: "Hologram IoT", statusUrl: "https://status.hologram.io", parser: "statuspage_json", status: "operational" },
  { key: "balena", name: "Balena", statusUrl: "https://status.balena.io", parser: "statuspage_json", status: "operational" },
  { key: "blues-wireless", name: "Blues Wireless", statusUrl: "https://status.blues.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // SOCIAL MEDIA & MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  { key: "hootsuite", name: "Hootsuite", statusUrl: "https://status.hootsuite.com", parser: "statuspage_json", status: "operational" },
  { key: "buffer", name: "Buffer", statusUrl: "https://status.buffer.com", parser: "statuspage_json", status: "operational" },
  { key: "sproutsocial", name: "Sprout Social", statusUrl: "https://status.sproutsocial.com", parser: "statuspage_json", status: "operational" },
  { key: "later", name: "Later", statusUrl: "https://status.later.com", parser: "statuspage_json", status: "operational" },
  { key: "sprinklr", name: "Sprinklr", statusUrl: "https://status.sprinklr.com", parser: "statuspage_json", status: "operational" },
  { key: "socialbee", name: "SocialBee", statusUrl: "https://socialbee.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // CMS & HEADLESS CMS
  // ═══════════════════════════════════════════════════════════════
  { key: "contentstack", name: "Contentstack", statusUrl: "https://status.contentstack.com", parser: "statuspage_json", status: "operational" },
  { key: "hygraph", name: "Hygraph (GraphCMS)", statusUrl: "https://status.hygraph.com", parser: "statuspage_json", status: "operational" },
  { key: "strapi-cloud", name: "Strapi Cloud", statusUrl: "https://status.strapi.io", parser: "statuspage_json", status: "operational" },
  { key: "builder-io", name: "Builder.io", statusUrl: "https://status.builder.io", parser: "statuspage_json", status: "operational" },
  { key: "prismic", name: "Prismic", statusUrl: "https://status.prismic.io", parser: "statuspage_json", status: "operational" },
  { key: "agility-cms", name: "Agility CMS", statusUrl: "https://status.agilitycms.com", parser: "statuspage_json", status: "operational" },
  { key: "wordpress-com", name: "WordPress.com", statusUrl: "https://automatticstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "craft-cms", name: "Craft Cloud", statusUrl: "https://status.craftcms.com", parser: "statuspage_json", status: "operational" },
  { key: "kentico", name: "Kentico Kontent", statusUrl: "https://status.kontent.ai", parser: "statuspage_json", status: "operational" },
  { key: "butter-cms", name: "ButterCMS", statusUrl: "https://buttercms.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // FEATURE FLAGS & EXPERIMENTATION
  // ═══════════════════════════════════════════════════════════════
  { key: "split", name: "Split.io", statusUrl: "https://status.split.io", parser: "statuspage_json", status: "operational" },
  { key: "configcat", name: "ConfigCat", statusUrl: "https://configcat.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "statsig", name: "Statsig", statusUrl: "https://status.statsig.com", parser: "statuspage_json", status: "operational" },
  { key: "flagsmith", name: "Flagsmith", statusUrl: "https://flagsmith.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT ANALYTICS & USER ENGAGEMENT
  // ═══════════════════════════════════════════════════════════════
  { key: "pendo", name: "Pendo", statusUrl: "https://status.pendo.io", parser: "statuspage_json", status: "operational" },
  { key: "appcues", name: "Appcues", statusUrl: "https://status.appcues.com", parser: "statuspage_json", status: "operational" },
  { key: "logrocket", name: "LogRocket", statusUrl: "https://status.logrocket.com", parser: "statuspage_json", status: "operational" },
  { key: "rollbar", name: "Rollbar", statusUrl: "https://status.rollbar.com", parser: "statuspage_json", status: "operational" },
  { key: "bugsnag", name: "Bugsnag", statusUrl: "https://status.bugsnag.com", parser: "statuspage_json", status: "operational" },
  { key: "airbrake", name: "Airbrake", statusUrl: "https://status.airbrake.io", parser: "statuspage_json", status: "operational" },
  { key: "smartlook", name: "Smartlook", statusUrl: "https://status.smartlook.com", parser: "statuspage_json", status: "operational" },
  { key: "mouseflow", name: "Mouseflow", statusUrl: "https://mouseflow.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "gainsight", name: "Gainsight", statusUrl: "https://status.gainsight.com", parser: "statuspage_json", status: "operational" },
  { key: "uservoice", name: "UserVoice", statusUrl: "https://status.uservoice.com", parser: "statuspage_json", status: "operational" },
  { key: "chameleon", name: "Chameleon", statusUrl: "https://status.chameleon.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // DEVELOPER APIs & SERVICES
  // ═══════════════════════════════════════════════════════════════
  { key: "nylas", name: "Nylas", statusUrl: "https://status.nylas.com", parser: "statuspage_json", status: "operational" },
  { key: "lob", name: "Lob", statusUrl: "https://status.lob.com", parser: "statuspage_json", status: "operational" },
  { key: "veriff", name: "Veriff", statusUrl: "https://status.veriff.com", parser: "statuspage_json", status: "operational" },
  { key: "onfido", name: "Onfido", statusUrl: "https://status.onfido.com", parser: "statuspage_json", status: "operational" },
  { key: "persona", name: "Persona", statusUrl: "https://status.withpersona.com", parser: "statuspage_json", status: "operational" },
  { key: "twilio-verify", name: "Twilio Verify", statusUrl: "https://status.twilio.com", parser: "statuspage_json", status: "operational" },
  { key: "snappdf", name: "SnapPDF", statusUrl: "https://snappdf.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "apilayer", name: "APILayer", statusUrl: "https://status.apilayer.com", parser: "statuspage_json", status: "operational" },
  { key: "abstract-api", name: "Abstract API", statusUrl: "https://abstractapi.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "ipinfo", name: "IPinfo", statusUrl: "https://status.ipinfo.io", parser: "statuspage_json", status: "operational" },
  { key: "ipapi", name: "ipapi", statusUrl: "https://ipapi.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "exchangerate-api", name: "ExchangeRate-API", statusUrl: "https://exchangerateapi.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "openweather", name: "OpenWeather", statusUrl: "https://openweather.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "geocodio", name: "Geocodio", statusUrl: "https://geocodio.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "radar", name: "Radar", statusUrl: "https://status.radar.com", parser: "statuspage_json", status: "operational" },
  { key: "here", name: "HERE Technologies", statusUrl: "https://status.here.com", parser: "statuspage_json", status: "operational" },
  { key: "tomtom", name: "TomTom", statusUrl: "https://status.tomtom.com", parser: "statuspage_json", status: "operational" },
  { key: "what3words", name: "what3words", statusUrl: "https://status.what3words.com", parser: "statuspage_json", status: "operational" },
  { key: "transloadit", name: "Transloadit", statusUrl: "https://transloadit.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // SERVERLESS & EDGE COMPUTING
  // ═══════════════════════════════════════════════════════════════
  { key: "nhost", name: "Nhost", statusUrl: "https://nhost.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "appwrite", name: "Appwrite Cloud", statusUrl: "https://status.appwrite.online", parser: "statuspage_json", status: "operational" },
  { key: "firebase", name: "Firebase", statusUrl: "https://status.firebase.google.com", parser: "generic_html", status: "operational" },
  { key: "azure-devops", name: "Azure DevOps", statusUrl: "https://status.dev.azure.com", parser: "generic_html", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // TELECOM & CPaaS
  // ═══════════════════════════════════════════════════════════════
  { key: "kaleyra", name: "Kaleyra", statusUrl: "https://status.kaleyra.com", parser: "statuspage_json", status: "operational" },
  { key: "nexmo", name: "Vonage API (Nexmo)", statusUrl: "https://vonageapi.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "telesign", name: "TeleSign", statusUrl: "https://status.telesign.com", parser: "statuspage_json", status: "operational" },
  { key: "signalwire", name: "SignalWire", statusUrl: "https://status.signalwire.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // GOVERNMENT & PUBLIC CLOUD
  // ═══════════════════════════════════════════════════════════════
  { key: "aws-govcloud", name: "AWS GovCloud", statusUrl: "https://health.aws.amazon.com/health/status", parser: "generic_html", status: "operational" },
  { key: "azure-gov", name: "Azure Government", statusUrl: "https://status.azure.us", parser: "generic_html", status: "operational" },
  { key: "login-gov", name: "Login.gov", statusUrl: "https://logingov.statuspage.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // ENTERPRISE SOFTWARE
  // ═══════════════════════════════════════════════════════════════
  { key: "servicenow", name: "ServiceNow", statusUrl: "https://status.servicenow.com", parser: "generic_html", status: "operational" },
  { key: "sap", name: "SAP", statusUrl: "https://www.sap.com/about/cloud-trust-center/cloud-service-status.html", parser: "generic_html", status: "operational" },
  { key: "vmware", name: "VMware Cloud", statusUrl: "https://status.vmware-services.io", parser: "statuspage_json", status: "operational" },
  { key: "citrix", name: "Citrix Cloud", statusUrl: "https://status.cloud.com", parser: "statuspage_json", status: "operational" },
  { key: "box-shield", name: "Box Shield", statusUrl: "https://status.box.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // SEARCH PLATFORMS
  // ═══════════════════════════════════════════════════════════════
  { key: "meilisearch", name: "Meilisearch Cloud", statusUrl: "https://status.meilisearch.com", parser: "statuspage_json", status: "operational" },
  { key: "typesense", name: "Typesense Cloud", statusUrl: "https://status.typesense.org", parser: "statuspage_json", status: "operational" },
  { key: "bonsai", name: "Bonsai Elasticsearch", statusUrl: "https://status.bonsai.io", parser: "statuspage_json", status: "operational" },
  { key: "swiftype", name: "Swiftype", statusUrl: "https://status.swiftype.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // COLLABORATION & COMMUNICATION (More)
  // ═══════════════════════════════════════════════════════════════
  { key: "webex", name: "Webex", statusUrl: "https://status.webex.com", parser: "generic_html", status: "operational" },
  { key: "gotomeeting", name: "GoTo Meeting", statusUrl: "https://status.goto.com", parser: "statuspage_json", status: "operational" },
  { key: "bluejeans", name: "BlueJeans", statusUrl: "https://status.bluejeans.com", parser: "statuspage_json", status: "operational" },
  { key: "rocket-chat", name: "Rocket.Chat", statusUrl: "https://status.rocket.chat", parser: "statuspage_json", status: "operational" },
  { key: "matrix", name: "Matrix.org", statusUrl: "https://status.matrix.org", parser: "statuspage_json", status: "operational" },
  { key: "element", name: "Element", statusUrl: "https://status.element.io", parser: "statuspage_json", status: "operational" },
  { key: "changetip", name: "Chatwoot", statusUrl: "https://status.chatwoot.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONAL DEVOPS & INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════
  { key: "terraform-cloud", name: "Terraform Cloud", statusUrl: "https://status.hashicorp.com", parser: "statuspage_json", status: "operational" },
  { key: "pulumi", name: "Pulumi", statusUrl: "https://status.pulumi.com", parser: "statuspage_json", status: "operational" },
  { key: "spacelift", name: "Spacelift", statusUrl: "https://status.spacelift.io", parser: "statuspage_json", status: "operational" },
  { key: "env0", name: "env0", statusUrl: "https://status.env0.com", parser: "statuspage_json", status: "operational" },
  { key: "portainer", name: "Portainer", statusUrl: "https://status.portainer.io", parser: "statuspage_json", status: "operational" },
  { key: "rancher", name: "Rancher", statusUrl: "https://status.rancher.com", parser: "statuspage_json", status: "operational" },
  { key: "teleport", name: "Teleport", statusUrl: "https://status.teleport.sh", parser: "statuspage_json", status: "operational" },
  { key: "gitlab-ci", name: "GitLab CI", statusUrl: "https://status.gitlab.com", parser: "statuspage_json", status: "operational" },
  { key: "octopus-deploy", name: "Octopus Deploy", statusUrl: "https://status.octopus.com", parser: "statuspage_json", status: "operational" },
  { key: "spinnaker", name: "Armory (Spinnaker)", statusUrl: "https://status.armory.io", parser: "statuspage_json", status: "operational" },
  { key: "codefresh", name: "Codefresh", statusUrl: "https://status.codefresh.io", parser: "statuspage_json", status: "operational" },
  { key: "dagger", name: "Dagger", statusUrl: "https://status.dagger.io", parser: "statuspage_json", status: "operational" },
  { key: "earthly", name: "Earthly Cloud", statusUrl: "https://status.earthly.dev", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // EMAIL SERVICES
  // ═══════════════════════════════════════════════════════════════
  { key: "mailtrap", name: "Mailtrap", statusUrl: "https://status.mailtrap.io", parser: "statuspage_json", status: "operational" },
  { key: "resend", name: "Resend", statusUrl: "https://resend-status.com", parser: "statuspage_json", status: "operational" },
  { key: "smtp2go", name: "SMTP2GO", statusUrl: "https://smtp2go.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "elastic-email", name: "Elastic Email", statusUrl: "https://status.elasticemail.com", parser: "statuspage_json", status: "operational" },
  { key: "pepipost", name: "Pepipost (Netcore)", statusUrl: "https://status.pepipost.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // LOW-CODE / NO-CODE
  // ═══════════════════════════════════════════════════════════════
  { key: "bubble", name: "Bubble", statusUrl: "https://status.bubble.io", parser: "statuspage_json", status: "operational" },
  { key: "outsystems", name: "OutSystems", statusUrl: "https://status.outsystems.com", parser: "statuspage_json", status: "operational" },
  { key: "mendix", name: "Mendix", statusUrl: "https://status.mendix.com", parser: "statuspage_json", status: "operational" },
  { key: "appsmith", name: "Appsmith", statusUrl: "https://status.appsmith.com", parser: "statuspage_json", status: "operational" },
  { key: "internal", name: "Internal.io", statusUrl: "https://status.internal.io", parser: "statuspage_json", status: "operational" },
  { key: "glide", name: "Glide", statusUrl: "https://status.glideapps.com", parser: "statuspage_json", status: "operational" },
  { key: "softr", name: "Softr", statusUrl: "https://status.softr.io", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONAL MISC SERVICES
  // ═══════════════════════════════════════════════════════════════
  { key: "samsara", name: "Samsara", statusUrl: "https://status.samsara.com", parser: "statuspage_json", status: "operational" },
  { key: "datarobot", name: "DataRobot", statusUrl: "https://status.datarobot.com", parser: "statuspage_json", status: "operational" },
  { key: "databricks", name: "Databricks", statusUrl: "https://status.databricks.com", parser: "statuspage_json", status: "operational" },
  { key: "fivetran", name: "Fivetran", statusUrl: "https://status.fivetran.com", parser: "statuspage_json", status: "operational" },
  { key: "airbyte", name: "Airbyte Cloud", statusUrl: "https://status.airbyte.com", parser: "statuspage_json", status: "operational" },
  { key: "stitch", name: "Stitch Data", statusUrl: "https://status.stitchdata.com", parser: "statuspage_json", status: "operational" },
  { key: "dbt-cloud", name: "dbt Cloud", statusUrl: "https://status.getdbt.com", parser: "statuspage_json", status: "operational" },
  { key: "census", name: "Census", statusUrl: "https://status.getcensus.com", parser: "statuspage_json", status: "operational" },
  { key: "hightouch", name: "Hightouch", statusUrl: "https://status.hightouch.com", parser: "statuspage_json", status: "operational" },
  { key: "hex", name: "Hex", statusUrl: "https://status.hex.tech", parser: "statuspage_json", status: "operational" },
  { key: "retool-db", name: "Retool Database", statusUrl: "https://status.retool.com", parser: "statuspage_json", status: "operational" },
  { key: "metabase", name: "Metabase Cloud", statusUrl: "https://status.metabase.com", parser: "statuspage_json", status: "operational" },
  { key: "looker", name: "Looker (Google)", statusUrl: "https://status.cloud.google.com", parser: "generic_html", status: "operational" },
  { key: "mode", name: "Mode Analytics", statusUrl: "https://status.mode.com", parser: "statuspage_json", status: "operational" },
  { key: "sisense", name: "Sisense", statusUrl: "https://status.sisense.com", parser: "statuspage_json", status: "operational" },
  { key: "preset", name: "Preset (Superset Cloud)", statusUrl: "https://status.preset.io", parser: "statuspage_json", status: "operational" },
  { key: "tableau", name: "Tableau Cloud", statusUrl: "https://trust.salesforce.com/en/status/tableau", parser: "generic_html", status: "operational" },
  { key: "power-bi", name: "Power BI", statusUrl: "https://status.office.com", parser: "generic_html", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // WEB ANALYTICS & TESTING
  // ═══════════════════════════════════════════════════════════════
  { key: "plausible", name: "Plausible Analytics", statusUrl: "https://plausible.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "fathom", name: "Fathom Analytics", statusUrl: "https://status.usefathom.com", parser: "statuspage_json", status: "operational" },
  { key: "matomo", name: "Matomo Cloud", statusUrl: "https://matomo.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "vwo", name: "VWO", statusUrl: "https://status.vwo.com", parser: "statuspage_json", status: "operational" },
  { key: "launchnotes", name: "LaunchNotes", statusUrl: "https://status.launchnotes.com", parser: "statuspage_json", status: "operational" },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONAL SAAS & TOOLS
  // ═══════════════════════════════════════════════════════════════
  { key: "webflow-ecom", name: "Webflow Ecommerce", statusUrl: "https://status.webflow.com", parser: "statuspage_json", status: "operational" },
  { key: "intercom-msgs", name: "Intercom Messenger", statusUrl: "https://www.intercomstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "cribl", name: "Cribl Cloud", statusUrl: "https://status.cribl.io", parser: "statuspage_json", status: "operational" },
  { key: "lacework-cloud", name: "Lacework Cloud Security", statusUrl: "https://status.lacework.com", parser: "statuspage_json", status: "operational" },
  { key: "snyk-container", name: "Snyk Container", statusUrl: "https://status.snyk.io", parser: "statuspage_json", status: "operational" },
  { key: "harbor", name: "Harbor Registry", statusUrl: "https://status.goharbor.io", parser: "statuspage_json", status: "operational" },
  { key: "jfrog-artifactory", name: "JFrog Artifactory Cloud", statusUrl: "https://status.jfrog.com", parser: "statuspage_json", status: "operational" },
  { key: "sonatype", name: "Sonatype", statusUrl: "https://status.sonatype.com", parser: "statuspage_json", status: "operational" },
  { key: "nexus", name: "Sonatype Nexus", statusUrl: "https://status.sonatype.com", parser: "statuspage_json", status: "operational" },
  { key: "github-copilot", name: "GitHub Copilot", statusUrl: "https://www.githubstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "codeium", name: "Codeium", statusUrl: "https://status.codeium.com", parser: "statuspage_json", status: "operational" },
  { key: "tabnine", name: "Tabnine", statusUrl: "https://status.tabnine.com", parser: "statuspage_json", status: "operational" },
  { key: "gitguardian", name: "GitGuardian", statusUrl: "https://status.gitguardian.com", parser: "statuspage_json", status: "operational" },
  { key: "tines", name: "Tines", statusUrl: "https://status.tines.com", parser: "statuspage_json", status: "operational" },
  { key: "torq", name: "Torq", statusUrl: "https://status.torq.io", parser: "statuspage_json", status: "operational" },
  { key: "swimlane", name: "Swimlane", statusUrl: "https://status.swimlane.com", parser: "statuspage_json", status: "operational" },
  { key: "sumo", name: "Sumo Logic Cloud SIEM", statusUrl: "https://status.sumologic.com", parser: "statuspage_json", status: "operational" },
  { key: "elastic-siem", name: "Elastic Security", statusUrl: "https://status.elastic.co", parser: "statuspage_json", status: "operational" },
  { key: "splunk-soar", name: "Splunk SOAR", statusUrl: "https://www.splunkstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "mend", name: "Mend (WhiteSource)", statusUrl: "https://status.mend.io", parser: "statuspage_json", status: "operational" },
  { key: "fossa", name: "FOSSA", statusUrl: "https://fossa.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "socket-dev", name: "Socket.dev", statusUrl: "https://socket-security.statuspage.io", parser: "statuspage_json", status: "operational" },
  { key: "semgrep", name: "Semgrep", statusUrl: "https://status.semgrep.dev", parser: "statuspage_json", status: "operational" },
  { key: "doppler", name: "Doppler", statusUrl: "https://status.doppler.com", parser: "statuspage_json", status: "operational" },
  { key: "1password-events", name: "1Password Events", statusUrl: "https://status.1password.com", parser: "statuspage_json", status: "operational" },
  { key: "infisical", name: "Infisical", statusUrl: "https://status.infisical.com", parser: "statuspage_json", status: "operational" },
  { key: "hashicorp-vault", name: "HashiCorp Vault", statusUrl: "https://status.hashicorp.com", parser: "statuspage_json", status: "operational" },
];

export const NEW_STATUSPAGE_URLS: Record<string, string> = {};

for (const vendor of NEW_VENDORS) {
  if (vendor.parser === "statuspage_json") {
    NEW_STATUSPAGE_URLS[vendor.key] = vendor.statusUrl;
  }
}
