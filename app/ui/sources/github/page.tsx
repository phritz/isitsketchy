"use client";

import { useEffect, useState } from "react";
import {
  Anchor,
  Button,
  Container,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  clearGithubRepos,
  deleteGithubRepo,
  listGithubRepos,
  type GithubRepoSummary,
} from "@/app/api/sources/github/client";

export default function GithubCachePage() {
  const [rows, setRows] = useState<GithubRepoSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState<boolean>(false);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const data = await listGithubRepos();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cache");
    }
  }

  useEffect(() => {
    let active: boolean = true;
    void (async () => {
      try {
        const data = await listGithubRepos();
        if (active) {
          setRows(data);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load cache");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onRemove(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await deleteGithubRepo(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove entry");
    } finally {
      setBusyId(null);
    }
  }

  async function onClearAll(): Promise<void> {
    setClearing(true);
    setError(null);
    try {
      await clearGithubRepos();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear cache");
    } finally {
      setClearing(false);
    }
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>GitHub cache</Title>
          <Anchor href="/">Home</Anchor>
        </Group>

        <Group justify="space-between" align="center">
          <Text c="dimmed">
            {rows.length} cached {rows.length === 1 ? "repo" : "repos"}
          </Text>
          <Button
            color="red"
            variant="light"
            onClick={onClearAll}
            loading={clearing}
            disabled={rows.length === 0}
          >
            Clear all
          </Button>
        </Group>

        {error ? <Text c="red">{error}</Text> : null}

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>URL</Table.Th>
              <Table.Th>Fetched</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed">No cached repos yet.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.url}</Table.Td>
                  <Table.Td>
                    {new Date(row.fetchedAt).toLocaleString()}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => onRemove(row.id)}
                      loading={busyId === row.id}
                    >
                      Remove
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Container>
  );
}
