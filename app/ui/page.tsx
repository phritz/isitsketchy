import {
  Anchor,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { HomeSearch } from "@/app/home-search";
import { NpmSearch } from "@/app/home-npm-search";

export default function Home() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Is It Sketchy?</Title>
      <Text mt="md">
        Is It Sketchy? shows trustworthiness signals for a GitHub repo or npm
        package, evaluating trustworthiness based on repo and package metadata.
      </Text>
      <Text mt="md">
        It currently only works for direct dependencies. Repo metadata and
        package metadata are cached, so if you want to fetch fresh data, clear
        the cache with the cache management links at the bottom of the page.
      </Text>

      <Group mt="md">
        <Anchor href="/ui/analysis">View past analyses</Anchor>
        <Anchor href="/ui/signals">How signals work</Anchor>
      </Group>

      <Stack gap="xl" mt="xl">
        <section>
          <Title order={2}>Analyze a repo</Title>
          <HomeSearch />
        </section>

        <Divider />

        <section>
          <Title order={2}>Analyze an npm package</Title>
          <NpmSearch />
        </section>
      </Stack>

      <Divider mt="xl" />

      <Stack gap={4} mt="xl">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          Debug
        </Text>
        <Group gap="md">
          <Anchor href="/ui/sources/github" size="xs" c="dimmed">
            GitHub cache management
          </Anchor>
          <Anchor href="/ui/sources/npm" size="xs" c="dimmed">
            npm cache management
          </Anchor>
          <Anchor
            href="https://github.com/phritz/isitsketchy"
            target="_blank"
            rel="noreferrer"
            size="xs"
            c="dimmed"
          >
            Is It Sketchy? on GitHub
          </Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
