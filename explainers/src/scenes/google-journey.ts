import type { ExplainerDef } from "../framework/types";
import { SceneBrowserCache, SceneInput, SceneOsCache } from "./scenes-browser";
import { SceneAuthoritative, SceneIpReturns, SceneResolver, SceneRoot, SceneTld } from "./scenes-dns";
import { SceneHttp, SceneTcp, SceneTls } from "./scenes-connect";
import { SceneDone, SceneRender, SceneResponse, SceneServer } from "./scenes-server";

export const googleJourney: ExplainerDef = {
  slug: "google",
  title: "The journey of google.com",
  scenes: [
    {
      id: "input",
      chapter: "The Browser",
      question: "What did you actually type?",
      title: "First, the browser reads what you wrote.",
      narration: "Before anything touches the network, the browser has to decide: is this a search, or an address?",
      whatHappened:
        "The browser parsed your text, recognized “google.com” as a domain, and expanded it into a full URL: https://google.com/.",
      nextPrompt: "So where does it look first?",
      duration: 5.2,
      Component: SceneInput,
    },
    {
      id: "browser-cache",
      chapter: "The Browser",
      question: "Have we been here before?",
      title: "The browser checks its own notebook.",
      narration: "Domains it has met recently are written down next to their addresses. It looks for google.com…",
      whatHappened:
        "The browser searched its DNS cache — a list of recently resolved domains — and found no entry for google.com.",
      nextPrompt: "Who else might know?",
      duration: 5.0,
      Component: SceneBrowserCache,
    },
    {
      id: "os-cache",
      chapter: "The Browser",
      question: "Does the machine know?",
      title: "It asks the operating system next door.",
      narration: "The OS keeps its own address book — a resolver cache, plus an old-fashioned hosts file.",
      whatHappened:
        "The operating system checked its resolver cache and hosts file. Another miss — nothing on this machine knows where google.com lives.",
      nextPrompt: "Time to ask the internet",
      duration: 6.0,
      Component: SceneOsCache,
    },
    {
      id: "resolver",
      chapter: "Finding the Address",
      question: "Who do you ask when nobody knows?",
      title: "Your browser doesn't know where Google lives.",
      narration: "So the question leaves your machine for the first time — bound for a DNS resolver whose whole job is finding out.",
      whatHappened:
        "Your computer sent a DNS query to a recursive resolver (usually run by your ISP, or a public one like 8.8.8.8). It will chase the answer for you.",
      nextPrompt: "Where does the resolver start?",
      duration: 5.2,
      Component: SceneResolver,
    },
    {
      id: "root",
      chapter: "Finding the Address",
      question: "Where does every search begin?",
      title: "At the top: the root servers.",
      narration: "The root doesn't know google.com. But it knows who keeps the book of every “.com”.",
      whatHappened:
        "The resolver asked a root server, which replied with a referral: “I don't know google.com, but here are the servers responsible for .com.”",
      nextPrompt: "Down one level",
      duration: 4.8,
      Component: SceneRoot,
    },
    {
      id: "tld",
      chapter: "Finding the Address",
      question: "Who keeps the book of .com?",
      title: "The .com registry narrows it down.",
      narration: "160 million domains end in .com. This server knows who speaks for each one of them.",
      whatHappened:
        "The .com TLD server didn't know Google's address either — but it knew exactly which name servers do: Google's own.",
      nextPrompt: "Ask Google itself",
      duration: 4.6,
      Component: SceneTld,
    },
    {
      id: "authoritative",
      chapter: "Finding the Address",
      question: "Who has the final word?",
      title: "Someone finally knows the answer.",
      narration: "ns1.google.com is run by Google itself. Its answer isn't a rumor — it's the source of truth.",
      whatHappened:
        "Google's authoritative name server answered with an A record: google.com lives at 142.250.72.14.",
      nextPrompt: "Bring the answer home",
      duration: 5.6,
      Component: SceneAuthoritative,
    },
    {
      id: "ip",
      chapter: "Finding the Address",
      question: "Was all that worth it?",
      title: "The address travels home — and everyone takes notes.",
      narration: "Resolver, operating system, browser: each one writes the answer down so nobody has to ask twice.",
      whatHappened:
        "The IP address was cached at every stop on the way back, each copy with a time-to-live. The next lookup will be answered instantly, from memory.",
      nextPrompt: "Now — knock on the door",
      duration: 5.6,
      Component: SceneIpReturns,
    },
    {
      id: "tcp",
      chapter: "Making Contact",
      question: "Can we even talk?",
      title: "Two computers greet each other.",
      narration: "Knowing an address isn't a conversation. Before exchanging anything, both sides confirm the line works.",
      whatHappened:
        "Your computer and Google's server performed TCP's three-way handshake — SYN, SYN-ACK, ACK — establishing a reliable, ordered connection.",
      nextPrompt: "But can anyone eavesdrop?",
      duration: 6.8,
      Component: SceneTcp,
    },
    {
      id: "tls",
      chapter: "Making Contact",
      question: "How do strangers share a secret?",
      title: "The conversation goes private.",
      narration: "Google proves its identity with a certificate. Then both sides derive a secret key — without ever sending it.",
      whatHappened:
        "The TLS handshake verified Google's certificate and produced a shared encryption key. Everything from here on travels through an encrypted tunnel.",
      nextPrompt: "Finally — ask for the page",
      duration: 6.8,
      Component: SceneTls,
    },
    {
      id: "http",
      chapter: "The Conversation",
      question: "What do we actually say?",
      title: "After all that: one polite sentence.",
      narration: "Milliseconds of ceremony, all so the browser can send a few lines of text through the tunnel.",
      whatHappened:
        "The browser sent an HTTP request — “GET / ” plus headers describing itself and what formats it accepts — through the encrypted connection.",
      nextPrompt: "What happens on the other side?",
      duration: 5.6,
      Component: SceneHttp,
    },
    {
      id: "server",
      chapter: "The Conversation",
      question: "Who answers, exactly?",
      title: "Inside a building full of humming machines.",
      narration: "There is no single “Google server”. A load balancer picks one healthy machine out of thousands to serve you.",
      whatHappened:
        "A load balancer routed your request to a frontend server, which assembled the homepage HTML — personalized for your language and location — in a few milliseconds.",
      nextPrompt: "Send it back",
      duration: 5.4,
      Component: SceneServer,
    },
    {
      id: "response",
      chapter: "The Conversation",
      question: "How does a page travel?",
      title: "The answer comes back in pieces.",
      narration: "Not one delivery — dozens of numbered packets, racing home, reassembled in order on arrival.",
      whatHappened:
        "The server replied “200 OK” and streamed the compressed HTML back as a sequence of packets, which TCP reassembled into a complete document.",
      nextPrompt: "Turn text into a page",
      duration: 5.8,
      Component: SceneResponse,
    },
    {
      id: "render",
      chapter: "The Reveal",
      question: "How does text become pixels?",
      title: "The browser starts to draw.",
      narration: "The HTML is parsed into a tree, the tree into boxes, the boxes into pixels on your screen.",
      whatHappened:
        "The browser parsed HTML into the DOM, calculated layout for every element, and painted the result — the pipeline behind every page you've ever seen.",
      nextPrompt: "Open your eyes",
      duration: 6.0,
      Component: SceneRender,
    },
    {
      id: "done",
      chapter: "The Reveal",
      question: "What did half a second buy?",
      title: "The page appears. It always looked instant.",
      narration: "Caches, referrals, handshakes, a datacenter, and a rendering engine — all invisible, all in ~300 milliseconds.",
      whatHappened:
        "Fifteen steps, four machines you own and thousands you don't, all cooperating in under half a second. That's what one Enter key sets in motion.",
      nextPrompt: "",
      duration: 5.4,
      Component: SceneDone,
    },
  ],
};
