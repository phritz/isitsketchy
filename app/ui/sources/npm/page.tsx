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
  clearNpmPackages,
  deleteNpmPackage,
  listNpmPackages,
  type NpmPackageSummary,
} from "@/app/api/sources/npm/client";

export default function NpmCachePage() {
  const [rows, setRows] = useState<NpmPackageSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState<boolean>(false);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const data = await listNpmPackages();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cache");
    }
  }

  useEffect(() => {
    let active: boolean = true;
    void (async () => {
      try {
        const data = await listNpmPackages();
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
      await deleteNpmPackage(id);
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
      await clearNpmPackages();
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
          <Title order={1}>npm cache</Title>
          <Anchor href="/">Home</Anchor>
        </Group>

        <Group justify="space-between" align="center">
          <Text c="dimmed">
            {rows.length} cached {rows.length === 1 ? "package" : "packages"}
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
              <Table.Th>Name</Table.Th>
              <Table.Th>Fetched</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed">No cached packages yet.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.name}</Table.Td>
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
