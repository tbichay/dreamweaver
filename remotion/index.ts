/**
 * Remotion Entry Point — Film Compositions
 *
 * This registers all video compositions that Remotion can render.
 * Used by the Remotion CLI and the rendering API.
 */

import { registerRoot } from "remotion";
import { FilmComposition } from "./FilmComposition";

registerRoot(FilmComposition);
