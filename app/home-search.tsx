"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { createAnalysis } from "@/app/api/analysis/client";

const ANTHROPIC_SDK_REPO_URL: string =
  "https://github.com/anthropics/anthropic-sdk-typescript";
const IS_IT_SKETCHY_REPO_URL: string =
  "https://github.com/phritz/isitsketchy";

type PendingSource = "anthropic" | "sketchy" | "input";

export function HomeSearch() {
  const router = useRouter();
  const [url, setUrl] = useState<string>("");
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(target: string, source: PendingSource): Promise<void> {
    const trimmed: string = target.trim();
    if (trimmed.length === 0) {
      return;
    }
    setUrl(trimmed);
    setPending(source);
    setError(null);
    try {
      const { id } = await createAnalysis(trimmed);
      router.push(`/ui/analysis/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      setPending(null);
    }
  }

  return (
    <Stack gap="md" mt="lg">
      <Group>
        <Button
          variant="light"
          onClick={() => analyze(ANTHROPIC_SDK_REPO_URL, "anthropic")}
          loading={pending === "anthropic"}
          disabled={pending !== null && pending !== "anthropic"}
        >
          Analyze Anthropic SDK repo
        </Button>
        <Button
          variant="light"
          onClick={() => analyze(IS_IT_SKETCHY_REPO_URL, "sketchy")}
          loading={pending === "sketchy"}
          disabled={pending !== null && pending !== "sketchy"}
        >
          Analyze &apos;Is It Sketchy?&apos; repo
        </Button>
      </Group>

      <Group align="flex-end">
        <TextInput
          label="GitHub repo URL"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void analyze(url, "input");
            }
          }}
          style={{ flex: 1 }}
        />
        <Button
          onClick={() => analyze(url, "input")}
          loading={pending === "input"}
          disabled={pending !== null && pending !== "input"}
        >
          Analyze
        </Button>
      </Group>

      {error ? <Text c="red">{error}</Text> : null}
    </Stack>
  );
}
