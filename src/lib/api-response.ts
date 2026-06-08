import { NextResponse } from "next/server";
import { isAppError } from "./app-error";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    message: string;
  };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function badRequest(message: string): NextResponse<ApiFailure> {
  return errorResponse(message, 400);
}

export function forbidden(message: string): NextResponse<ApiFailure> {
  return errorResponse(message, 403);
}

export function notFound(message: string): NextResponse<ApiFailure> {
  return errorResponse(message, 404);
}

export function serverError(message: string): NextResponse<ApiFailure> {
  return errorResponse(toFriendlyServerMessage(message), 500);
}

export function fromError(error: unknown): NextResponse<ApiFailure> {
  if (isAppError(error)) {
    return errorResponse(error.message, error.statusCode);
  }

  return serverError(error instanceof Error ? error.message : "Unexpected server error");
}

function errorResponse(message: string, status: number): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message
      }
    },
    { status }
  );
}

function toFriendlyServerMessage(message: string): string {
  if (
    message.includes("Environment variable not found: DATABASE_URL") ||
    message.includes("DATABASE_URL")
  ) {
    return "DATABASE_URL is missing. Copy .env.example to .env and start PostgreSQL with docker compose up -d.";
  }

  if (
    message.includes("Can't reach database server") ||
    message.includes("Can't reach database") ||
    message.includes("P1001")
  ) {
    return "Can't reach database server. Start PostgreSQL with docker compose up -d, then run pnpm prisma migrate dev.";
  }

  return message;
}
