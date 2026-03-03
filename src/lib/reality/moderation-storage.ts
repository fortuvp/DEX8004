export type FollowedQuestion = {
  questionId: `0x${string}`;
  followedAt: number;
};

const KEY = "moderation:followedQuestions:v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadFollowedQuestions(): FollowedQuestion[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<FollowedQuestion[]>(window.localStorage.getItem(KEY));
  return Array.isArray(parsed) ? parsed : [];
}

export function isFollowed(questionId: `0x${string}`) {
  return loadFollowedQuestions().some((q) => q.questionId === questionId);
}

export function follow(questionId: `0x${string}`) {
  const all = loadFollowedQuestions();
  if (all.some((q) => q.questionId === questionId)) return;
  const next = [{ questionId, followedAt: Date.now() }, ...all];
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function unfollow(questionId: `0x${string}`) {
  const all = loadFollowedQuestions();
  const next = all.filter((q) => q.questionId !== questionId);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
