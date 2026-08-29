import { governsChildren, isComposed, isRecurring, recurs, shapeOf } from './shape';
import type { Plan } from './contract';

const once: Plan = { recurs: false, countsFromCompletion: false };
const repeating: Plan = { recurs: true, countsFromCompletion: false };

describe('the four cells fall out of two axes', () => {
  it('no children, no recurrence is an action', () => {
    expect(shapeOf({ hasChildren: false, plan: once })).toBe('action');
  });

  it('no children, recurrence is a habit', () => {
    expect(shapeOf({ hasChildren: false, plan: repeating })).toBe('habit');
  });

  it('children, no recurrence is a project', () => {
    expect(shapeOf({ hasChildren: true, plan: once })).toBe('project');
  });

  it('children, recurrence is a routine', () => {
    expect(shapeOf({ hasChildren: true, plan: repeating })).toBe('routine');
  });

  // An unplanned item is not a defect — it is where a capture waits until
  // somebody decides when it happens.
  it('treats an unplanned item as non-recurring', () => {
    expect(shapeOf({ hasChildren: false, plan: null })).toBe('action');
    expect(shapeOf({ hasChildren: true, plan: null })).toBe('project');
  });
});

describe('the cell is derived, so it changes with the data and nothing is written', () => {
  // The whole reason for a single kind: adding a frequency moves the item
  // across the table at the next read, with no migration and no second state.
  it('adding recurrence turns an action into a habit', () => {
    const item = { hasChildren: false, plan: once };
    expect(shapeOf(item)).toBe('action');
    expect(shapeOf({ ...item, plan: repeating })).toBe('habit');
  });

  it('adding recurrence turns a project into a routine', () => {
    const item = { hasChildren: true, plan: once };
    expect(shapeOf(item)).toBe('project');
    expect(shapeOf({ ...item, plan: repeating })).toBe('routine');
  });

  it('removing recurrence turns it back', () => {
    expect(shapeOf({ hasChildren: true, plan: repeating })).toBe('routine');
    expect(shapeOf({ hasChildren: true, plan: once })).toBe('project');
  });

  // A project is not something created empty: it becomes one on gaining its
  // first child, which is the consequence accepted by the single-kind design.
  it('an action becomes a project when it gains a child', () => {
    expect(shapeOf({ hasChildren: false, plan: once })).toBe('action');
    expect(shapeOf({ hasChildren: true, plan: once })).toBe('project');
  });
});

describe('recurs', () => {
  it('is false without a plan', () => {
    expect(recurs(null)).toBe(false);
  });

  it('follows the plan when there is one', () => {
    expect(recurs(once)).toBe(false);
    expect(recurs(repeating)).toBe(true);
  });
});

describe('shape predicates', () => {
  it('knows which shapes are composed', () => {
    expect(isComposed('project')).toBe(true);
    expect(isComposed('routine')).toBe(true);
    expect(isComposed('action')).toBe(false);
    expect(isComposed('habit')).toBe(false);
  });

  it('knows which shapes repeat', () => {
    expect(isRecurring('habit')).toBe(true);
    expect(isRecurring('routine')).toBe(true);
    expect(isRecurring('action')).toBe(false);
    expect(isRecurring('project')).toBe(false);
  });
});

describe('governance is decided per child, not per parent', () => {
  it('a child without a plan is governed by its parent', () => {
    expect(governsChildren({ plan: null })).toBe(true);
  });

  it('a child with its own plan governs itself', () => {
    expect(governsChildren({ plan: once })).toBe(false);
    expect(governsChildren({ plan: repeating })).toBe(false);
  });

  // "Mudanza": a project whose children are heterogeneous. Both answers are
  // correct at the same time, which is what makes the mixed case expressible
  // without a second type.
  it('handles a mixed project — one child planned, one not', () => {
    const callTheMovers = { plan: once };
    const packTheBooks = { plan: null };

    expect(governsChildren(callTheMovers)).toBe(false);
    expect(governsChildren(packTheBooks)).toBe(true);
  });

  // "Conseguir una primera venta": a parent that is an intention in its own
  // right, all of whose children plan themselves. It is not thereby demoted to
  // a mere grouping — it keeps its own plan and its own state.
  it('a parent whose children all plan themselves is still a project', () => {
    const parent = { hasChildren: true, plan: once };
    const spreadAction = { plan: once };
    const ownFrequencyHabit = { plan: repeating };

    expect(shapeOf(parent)).toBe('project');
    expect(governsChildren(spreadAction)).toBe(false);
    expect(governsChildren(ownFrequencyHabit)).toBe(false);
  });
});
