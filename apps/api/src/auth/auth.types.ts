export type RequestUser = {
  userId: string;
  email: string;
  role: string;
};

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: string;
  typ: 'access';
};
