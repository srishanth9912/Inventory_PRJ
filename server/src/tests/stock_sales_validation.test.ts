import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { addStock } from '../services/stockService.js';
import { createSale } from '../services/salesService.js';
import { updateProduct } from '../services/productService.js';

describe('Stock & Sales Validation Unit Tests', () => {
  test('addStock rejects invalid units', async () => {
    await assert.rejects(
      async () => {
        await addStock('P1', 'kg' as any, 10);
      },
      { message: /Invalid unit/ }
    );
  });

  test('addStock rejects non-positive and non-integer quantities', async () => {
    await assert.rejects(
      async () => {
        await addStock('P1', 'piece', 0);
      },
      { message: /Invalid quantity/ }
    );

    await assert.rejects(
      async () => {
        await addStock('P1', 'piece', -5);
      },
      { message: /Invalid quantity/ }
    );

    await assert.rejects(
      async () => {
        await addStock('P1', 'piece', 2.5);
      },
      { message: /Invalid quantity/ }
    );
  });

  test('updateProduct rejects invalid numeric fields', async () => {
    await assert.rejects(
      async () => {
        await updateProduct('P1', { boxSize: 0 });
      },
      { message: /Box size must be an integer greater than 0/ }
    );

    await assert.rejects(
      async () => {
        await updateProduct('P1', { defaultPricePerPiece: -10 });
      },
      { message: /Default price per piece cannot be negative/ }
    );

    await assert.rejects(
      async () => {
        await updateProduct('P1', { currentStock: -1 });
      },
      { message: /Current stock must be a non-negative integer/ }
    );

    await assert.rejects(
      async () => {
        await updateProduct('P1', { lowStockLimit: -5 });
      },
      { message: /Low stock limit must be a non-negative integer/ }
    );
  });

  test('createSale rejects invalid item unit', async () => {
    await assert.rejects(
      async () => {
        await createSale({
          items: [{ productId: 'P1', unit: 'grams' as any, quantity: 1 }],
        });
      },
      { message: /Invalid unit/ }
    );
  });

  test('createSale rejects invalid price per piece', async () => {
    await assert.rejects(
      async () => {
        await createSale({
          items: [{ productId: 'P1', unit: 'piece', quantity: 1, pricePerPiece: -50 }],
        });
      },
      { message: /Price cannot be negative/ }
    );

    await assert.rejects(
      async () => {
        await createSale({
          items: [{ productId: 'P1', unit: 'piece', quantity: 1, pricePerPiece: Infinity }],
        });
      },
      { message: /Price cannot be negative/ }
    );
  });

  test('createSale rejects invalid quantities', async () => {
    await assert.rejects(
      async () => {
        await createSale({
          items: [{ productId: 'P1', unit: 'piece', quantity: -2 }],
        });
      },
      { message: /Invalid quantity/ }
    );

    await assert.rejects(
      async () => {
        await createSale({
          items: [{ productId: 'P1', unit: 'piece', quantity: 1.5 }],
        });
      },
      { message: /Invalid quantity/ }
    );
  });

  test('createSale rejects invalid sale date', async () => {
    await assert.rejects(
      async () => {
        await createSale({
          soldAt: -100,
          items: [{ productId: 'P1', unit: 'piece', quantity: 1 }],
        });
      },
      { message: /Invalid sale date/ }
    );
  });
});
