"use client";

import { useEffect, useState } from "react";
import {
  Anchor,
  Badge,
  Container,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  listAnalyses,
  type AnalysisRunSummary,
  type ResultStatus,
} from "@/app/api/analysis/client";

function statusColor(status: ResultStatus): string {
  switch (status) {
    case "completed":
      return "green";
    case "running":
      return "blue";
    case "failed":
      return "red";
    case "pending":
    default:
      return "gray";
  }
}

export default function AnalysisListPage() {
  const [rows, setRows] = useState<AnalysisRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active: boolean = true;
    void (async () => {
      try {
        const data = await listAnalyses();
        if (active) {
          setRows(data);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load analyses");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>Analyses</Title>
          <Anchor href="/ui">Home</Anchor>
        </Group>

        {error ? <Text c="red">{error}</Text> : null}

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Repo</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Subjects</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed">No analyses yet.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Anchor href={`/ui/analysis/${row.id}`}>
                      {row.repoUrl}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(row.status)}>{row.status}</Badge>
                  </Table.Td>
                  <Table.Td>{row.subjectCount}</Table.Td>
                  <Table.Td>
                    {new Date(row.createdAt).toLocaleString()}
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
