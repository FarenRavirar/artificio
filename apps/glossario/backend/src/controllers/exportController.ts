import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../config/database.js';
import { getCatalogNameMap } from '../services/catalogClient.js';

export const exportToMateCat = async (req: Request, res: Response) => {
  const { system_id, scenario_id } = req.query;

  try {
    let query = `
      SELECT
        t.name_en,
        t.name_pt,
        t.system_id,
        sc.name as scenario_name,
        c.name as category_name,
        t.book_reference,
        t.page_reference,
        t.nucleus
      FROM public.terms t
      LEFT JOIN public.scenarios sc ON t.scenario_id = sc.id
      LEFT JOIN public.categories c ON t.category_id = c.id
      WHERE t.status = 'verificado'
    `;
    const params: unknown[] = [];

    if (system_id) {
      params.push(system_id);
      query += ` AND t.system_id = $${params.length}`;
    }
    if (scenario_id) {
      params.push(scenario_id);
      query += ` AND t.scenario_id = $${params.length}`;
    }

    query += ` ORDER BY t.name_en ASC`;

    const result = await db.query(query, params);
    const names = await getCatalogNameMap();
    // Achado CodeRabbit (PR #145): result.rows chega como any[] do driver pg —
    // valida shape minimo (system_id string|null) antes do .map, em vez de
    // confiar cegamente no formato do banco.
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const terms = rows.map((row) => ({
      ...row,
      system_name: typeof row?.system_id === 'string' ? names.get(row.system_id) ?? null : null,
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('MateCat Glossary');

    // Colunas padrão para MateCat
    worksheet.columns = [
      { header: 'Source (EN)', key: 'name_en', width: 30 },
      { header: 'Target (PT)', key: 'name_pt', width: 30 },
      { header: 'Metadata / Context', key: 'metadata', width: 60 }
    ];

    // Estilo do Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF5722' } // Laranja Artifício (D064)
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    terms.forEach(term => {
      const metadata = [
        term.system_name ? `Sistema: ${term.system_name}` : '',
        term.scenario_name ? `Cenário: ${term.scenario_name}` : '',
        term.category_name ? `Categoria: ${term.category_name}` : '',
        term.book_reference ? `Livro: ${term.book_reference}` : '',
        term.page_reference ? `Página: ${term.page_reference}` : '',
        `Núcleo: ${term.nucleus}`
      ].filter(Boolean).join(' | ');

      worksheet.addRow({
        name_en: term.name_en,
        name_pt: term.name_pt,
        metadata: metadata
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=glossario_matecat.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erro ao exportar XLSX:', error);
    res.status(500).json({ error: 'Erro ao gerar o arquivo de exportação' });
  }
};
