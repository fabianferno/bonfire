#!/usr/bin/env python3
"""
BonFire Pipecat voice bot.

Spawned by backend/src/voice/worker-spawn.ts as a subprocess, one per active
Daily voice room.  All configuration is passed via environment variables.

Exit codes:
  0  clean shutdown (SIGTERM, room empty)
  2  missing required env var
  1  unhandled exception
"""
import asyncio
import os
import signal
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="[bot] %(message)s",
)
log = logging.getLogger("bot")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def env(name: str, default: str | None = None) -> str:
    """Read a required env var; exit 2 if missing and no default given."""
    v = os.environ.get(name, default)
    if v is None:
        log.error("missing required env: %s", name)
        sys.exit(2)
    return v  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

async def main() -> None:
    # -- Required env vars ---------------------------------------------------
    room_url    = env("DAILY_ROOM_URL")
    bot_token   = env("DAILY_BOT_TOKEN")
    dg_api_key  = env("DEEPGRAM_API_KEY")
    openai_key  = env("OPENAI_API_KEY")  # used for TTS
    og_base_url = env("OG_LLM_BASE_URL")
    og_api_key  = env("OG_LLM_API_KEY")
    og_model    = env("OG_LLM_MODEL", "gpt-4o-mini")

    # -- Optional env vars ---------------------------------------------------
    agent_soul = (
        os.environ.get("AGENT_SOUL", "").strip()
        or "You are a helpful voice assistant. Keep replies concise and friendly."
    )
    agent_name = os.environ.get("AGENT_NAME", "Ember")
    agent_slug = os.environ.get("AGENT_SLUG", "")
    tts_voice = os.environ.get("OPENAI_TTS_VOICE", "nova")  # alloy/echo/fable/onyx/nova/shimmer
    tts_model = os.environ.get("OPENAI_TTS_MODEL", "tts-1")

    log.info("joining room=%s agent=%s slug=%s", room_url, agent_name, agent_slug)

    # -- Pipecat imports (deferred so import errors surface clearly) ---------
    from pipecat.transports.services.daily import DailyTransport, DailyParams
    from pipecat.services.deepgram import DeepgramSTTService
    from pipecat.services.openai import OpenAILLMService, OpenAITTSService
    from pipecat.vad.silero import SileroVADAnalyzer
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.task import PipelineTask, PipelineParams
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

    # -- Transport -----------------------------------------------------------
    transport = DailyTransport(
        room_url,
        bot_token,
        agent_name,
        DailyParams(
            audio_out_enabled=True,
            transcription_enabled=False,   # we use Deepgram instead
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    # -- STT -----------------------------------------------------------------
    stt = DeepgramSTTService(api_key=dg_api_key)

    # -- LLM (OpenAI-compatible, pointed at 0G Compute) ----------------------
    llm = OpenAILLMService(
        api_key=og_api_key,
        model=og_model,
        base_url=og_base_url,
    )

    # -- Context (system prompt + greeting) ----------------------------------
    greeting = f"Hi, I'm {agent_name}. Let's talk!"
    messages = [
        {"role": "system", "content": agent_soul},
        {"role": "assistant", "content": greeting},
    ]
    context = OpenAILLMContext(messages=messages)
    context_aggregator = llm.create_context_aggregator(context)

    # -- TTS (OpenAI) --------------------------------------------------------
    tts = OpenAITTSService(
        api_key=openai_key,
        model=tts_model,
        voice=tts_voice,
    )

    # -- Pipeline ------------------------------------------------------------
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    task = PipelineTask(
        pipeline,
        PipelineParams(allow_interruptions=True),
    )

    # -- Event handlers ------------------------------------------------------

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):  # noqa: F811
        log.info("first participant joined: %s", participant.get("id", "?"))
        await transport.capture_participant_transcription(participant["id"])
        # Kick off the greeting utterance
        await task.queue_frames([context_aggregator.assistant().get_context_frame()])

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):  # noqa: F811
        log.info(
            "participant left: %s reason=%s remaining=%d",
            participant.get("id", "?"),
            reason,
            len(transport.get_participants()),
        )
        # Bot counts itself as a participant; if only 1 left that's us.
        if len(transport.get_participants()) <= 1:
            log.info("room empty — leaving")
            await task.cancel()

    @transport.event_handler("on_call_state_updated")
    async def on_call_state_updated(transport, state):  # noqa: F811
        log.info("call state=%s", state)
        if state == "left":
            await task.cancel()

    # -- SIGTERM handler -----------------------------------------------------
    loop = asyncio.get_event_loop()

    def _handle_sigterm(*_):
        log.info("SIGTERM received — leaving")
        loop.call_soon_threadsafe(
            lambda: asyncio.ensure_future(task.cancel())
        )

    signal.signal(signal.SIGTERM, _handle_sigterm)

    # -- Run -----------------------------------------------------------------
    runner = PipelineRunner()
    log.info("pipeline running")
    await runner.run(task)
    log.info("leaving room=%s", room_url)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("interrupted, exiting")
        sys.exit(0)
    except Exception as exc:
        log.exception("unhandled exception: %s", exc)
        sys.exit(1)
