"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { createAnalysis } from "@/app/api/analysis/client";

const ANTHROPIC_SDK_REPO_URL: string =
  "https://github.com/anthropics/anthropic-sdk-typescript";
const IS_IT_SKETCHY_REPO_URL: string =
  "https://github.com/phritz/isitsketchy";

export function HomeSearch() {
  const router = useRouter();
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(target: string): Promise<void> {
    const trimmed: string = target.trim();
    if (trimmed.length === 0) {
      return;
    }
    setUrl(trimmed);
    setLoading(true);
    setError(null);
    try {
      const { id } = await createAnalysis(trimmed);
      router.push(`/ui/analysis/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      setLoading(false);
    }
  }

  return (
    <Stack gap="md" mt="lg">
      <Group>
        <Button
          variant="light"
          onClick={() => analyze(ANTHROPIC_SDK_REPO_URL)}
          loading={loading}
        >
          Analyze Anthropic SDK repo
        </Button>
        <Button
          variant="light"
          onClick={() => analyze(IS_IT_SKETCHY_REPO_URL)}
          loading={loading}
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
              void analyze(url);
            }
          }}
          style={{ flex: 1 }}
        />
        <Button onClick={() => analyze(url)} loading={loading}>
          Analyze
        </Button>
      </Group>

      {error ? <Text c="red">{error}</Text> : null}
    </Stack>
  );
}
