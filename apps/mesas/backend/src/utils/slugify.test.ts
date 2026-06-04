/**
 * Exemplo de teste para o backend
 * 
 * Este arquivo serve como template e validação da configuração do Jest.
 * Substitua por testes reais conforme necessário.
 */

describe('Exemplo de Teste Backend', () => {
  it('deve passar em teste básico', () => {
    expect(1 + 1).toBe(2);
  });

  it('deve validar strings', () => {
    const texto = 'Mesas RPG';
    expect(texto).toContain('RPG');
    expect(texto).toHaveLength(9);
  });

  it('deve validar arrays', () => {
    const sistemas = ['D&D 5e', 'Pathfinder', 'Tormenta'];
    expect(sistemas).toHaveLength(3);
    expect(sistemas).toContain('D&D 5e');
  });

  it('deve validar objetos', () => {
    const mesa = {
      title: 'Aventura Épica',
      system: 'D&D 5e',
      slots: 4,
    };
    expect(mesa).toHaveProperty('title');
    expect(mesa.slots).toBe(4);
  });

  it('deve validar tipos', () => {
    expect(typeof 'texto').toBe('string');
    expect(typeof 123).toBe('number');
    expect(typeof true).toBe('boolean');
    expect(Array.isArray([])).toBe(true);
  });
});
