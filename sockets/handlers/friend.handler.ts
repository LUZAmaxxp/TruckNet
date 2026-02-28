import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/sockets/types";

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * registerFriendHandler
 *
 * Registers socket-level utilities for the friend request system.
 * NOTE: The primary friend request / accept / reject logic lives in the
 * HTTP API routes (/api/friends/*). Those routes emit `friend_request_received`
 * and `friend_request_accepted` server→client events via getIO().
 *
 * This handler is a registration point for any future client-initiated
 * friend socket events that may be added.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerFriendHandler(_io: IO, _socket: TSocket): void {
  // Future: socket.on("send_friend_request", handler)
}
