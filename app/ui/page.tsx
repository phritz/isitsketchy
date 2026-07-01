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
        package.
      </Text>
      <Text mt="xs" c="dimmed">
        Currently only works for direct dependencies.
      </Text>

      <Stack gap="xl" mt="xl">
        <section>
          <Group justify="space-between" align="center">
            <Title order={2}>GitHub repo</Title>
            <Anchor href="/ui/sources/github">GitHub cache management</Anchor>
          </Group>
          <HomeSearch />
        </section>

        <Divider />

        <section>
          <Group justify="space-between" align="center">
            <Title order={2}>npm package</Title>
            <Anchor href="/ui/sources/npm">npm cache management</Anchor>
          </Group>
          <NpmSearch />
        </section>
      </Stack>
    </Container>
  );
}
