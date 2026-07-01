import { Anchor, Container, Text, Title } from "@mantine/core";
import { HomeSearch } from "@/app/home-search";

export default function Home() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Is It Sketchy?</Title>
      <Text mt="md">
        Paste a GitHub repo URL to fetch and cache its metadata.
      </Text>
      <Anchor href="/ui/sources/github" mt="md" display="block">
        GitHub cache management
      </Anchor>
      <HomeSearch />
    </Container>
  );
}
