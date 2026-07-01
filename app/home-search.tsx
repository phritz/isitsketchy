"use client";

import { useState } from "react";
import {
  Button,
  Code,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  getGithubRepo,
  type GithubRepoData,
} from "@/app/api/sources/github/client";

export function HomeSearch() {
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GithubRepoData | null>(null);

  async function onSearch(): Promise<void> {
    const trimmed: string = url.trim();
    if (trimmed.length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await getGithubRepo(trimmed);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch repo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="md" mt="lg">
      <Group align="flex-end">
        <TextInput
          label="GitHub repo URL"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void onSearch();
            }
          }}
          style={{ flex: 1 }}
        />
        <Button onClick={onSearch} loading={loading}>
          Get
        </Button>
      </Group>

      {error ? <Text c="red">{error}</Text> : null}

      {result ? (
        <Stack gap="xs">
          <Text fw={600}>{result.repo.full_name}</Text>
          <Code block>{JSON.stringify(result, null, 2)}</Code>
        </Stack>
      ) : null}
    </Stack>
  );
}
