/**
 * The shared vocabulary for choosing what to attend to right now.
 *
 * Context, time available and energy required are not properties of any
 * item — they are a *selection filter* applied over a set that is already
 * ordered. Confirmed explicitly during Actions' own design (nau#95): an
 * item does not "belong to" a context, it is *tagged* with one.
 *
 * Lives here rather than in the substrate (alongside something like
 * `sortOrder`) because it is not generic infrastructure every block needs —
 * it is specifically GTD's mechanism of selection, with its own fixed
 * semantics (three dimensions, not an open tagging convention), consumed by
 * more than one module because more than one module participates in the
 * same engage flow: Actions for its Next Actions, References for its
 * review habit. GTD owns what the three dimensions mean; each relation
 * exposes that meaning to the module that filters by it, and each module
 * owns the tags it places on its own items using the underlying
 * `Tag`/`BlockTag` mechanism (`api`'s substrate, not GTD's).
 */

/** The three classic GTD dimensions used to choose what to do right now. */
export type SelectionDimension = 'context' | 'timeAvailable' | 'energy';

export interface SelectionTag {
  readonly dimension: SelectionDimension;
  /** e.g. '@casa', '@ordenador', '15min', 'alta'. Free-form per dimension. */
  readonly value: string;
}

/** Whether a set of tags satisfies a given filter, dimension by dimension. */
export function matchesSelection(
  tags: readonly SelectionTag[],
  filter: Partial<Record<SelectionDimension, string>>,
): boolean {
  return (Object.keys(filter) as SelectionDimension[]).every((dimension) => {
    const wanted = filter[dimension];
    if (wanted === undefined) return true;
    return tags.some((t) => t.dimension === dimension && t.value === wanted);
  });
}
