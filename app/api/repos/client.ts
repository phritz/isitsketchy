import axios from "axios";

export type Repo = {
  id: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type ListReposResponse = {
  ok: true;
  data: Repo[];
};

export type CreateRepoRequest = {
  url: string;
};

export type CreateRepoResponse = {
  ok: true;
  data: Repo;
};

export type ErrorResponse = {
  ok: false;
  error: { message: string };
};

const ENDPOINT: string = "/api/repos";

export async function listRepos(): Promise<Repo[]> {
  const res = await axios.get<ListReposResponse>(ENDPOINT);
  return res.data.data;
}

export async function createRepo(input: CreateRepoRequest): Promise<Repo> {
  const res = await axios.post<CreateRepoResponse>(ENDPOINT, input);
  return res.data.data;
}
