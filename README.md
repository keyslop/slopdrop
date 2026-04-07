# SlopDrop

Drop your voice slop on your own server.

One button. Record. Your unfiltered thoughts land on **YOUR** server — not some cloud. What happens next? Your problem.

Transcribe it. Feed it to AI. Make a YouTube script. Or let it rot. SlopDrop doesn't judge. SlopDrop doesn't care. SlopDrop is a pipe.

## Get Started

```bash
git clone https://github.com/keyslop/slopdrop
cd slopdrop
npm start
```

That's it. First run walks you through setup. Server running in 2 minutes. Scan QR with the iOS app (not yet published, wait or join). Done.

If the deployemnt fails, skills are prepared to help you fix it.

## How It Works

```
Phone                          Your Server
┌─────────┐                   ┌──────────────┐
│         │   HTTPS/upload    │              │
│  ● REC  │ ───────────────→ │  recordings/ │
│         │                   │              │
└─────────┘                   └──────┬───────┘
                                     │
                              Your agents pick
                              up the audio and
                              do whatever they want
```

1. Open app. Tap record. Talk. Tap stop.
2. Audio uploads to your server over HTTPS.
3. Your agents (scripts, AI pipelines, cron jobs) process it however you want.

SlopDrop has no opinion about step 3.

## FAQ

**Is this an AI product?**
No. It's a microphone that syncs to your server.

**Does it transcribe?**
No. Your agents do that. SlopDrop just drops the slop.

**Why "slop"?**
Because your voice memos at 7am while walking the dog are not polished content. They're slop. Beautiful, raw, unfiltered slop that your AI pipeline turns into gold.

**Who is this for?**
People who think in voice but work in text. People who don't trust messenger or NotAtAllSlop.ai with their ideas. People who find this README funny.

**Why self-hosted?**
Because why not? VPS is cheap and is fashionable again, cause you can set it up in 2 minutes the way YOU want it.

## The iOS App

One screen. One button. That's the whole app.

- Tap → recording starts (haptic feedback)
- Tap again → recording stops, upload begins
- Background upload (works after closing the app)
- Offline queue (records sync when you're back online)
- Lock screen widget (record without opening the app)

No transcription. No AI. No sharing. No accounts. No settings.


## License

MIT

## A []{-slop](https://github.com/keyslop) project
