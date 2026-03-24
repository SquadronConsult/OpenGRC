import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './auth.constants';

/** Marks route as not requiring JWT (used by global guard if added later). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
