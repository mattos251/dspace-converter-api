"""
Testes da preservação de campos comentados do input-forms.xml.

Execução (a partir da raiz do projeto):
    python -m unittest discover -s tests/python -v
"""

import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

CONVERTER_DIR = Path(__file__).resolve().parents[2] / "converter"
sys.path.insert(0, str(CONVERTER_DIR))

import main  # noqa: E402
from converter_inputforms_to_submissionforms import InputFormsToSubmissionFormsConverter  # noqa: E402
from main import DSpaceConverterOrchestrator  # noqa: E402


def field_xml(dc_element: str, label: str) -> str:
    return (
        "<field>"
        f"<dc-element>{dc_element}</dc-element>"
        f"<label>{label}</label>"
        "<input-type>onebox</input-type>"
        "<hint>Dica</hint>"
        "<required></required>"
        "</field>"
    )


def page_xml(number: int, body: str) -> str:
    return f'<page number="{number}">\n{body}\n</page>'


def input_forms_xml(form_body: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<input-forms>
  <form-map>
    <name-map collection-handle="123456789/1" form-name="Graduacao"/>
  </form-map>
  <form-definitions>
    <form name="Graduacao">
{form_body}
    </form>
  </form-definitions>
  <form-value-pairs>
    <value-pairs value-pairs-name="common_types" dc-term="type">
      <pair><displayed-value>Artigo</displayed-value><stored-value>Artigo</stored-value></pair>
    </value-pairs>
  </form-value-pairs>
</input-forms>
"""


MULTILINE_COMMENTED_FIELD = """<!--
        <field>
          <dc-element>identifier</dc-element>
          <dc-qualifier>uri</dc-qualifier>
          <label>URI</label>
          <input-type>onebox</input-type>
          <hint>Link</hint>
          <required></required>
        </field>
        -->"""

ONE_LINE_COMMENTED_FIELD = (
    "<!--" + field_xml("subject", "Assunto") + "-->"
)

TWO_FIELDS_IN_ONE_COMMENT = (
    "<!--" + field_xml("description", "Resumo") + field_xml("format", "Formato") + "-->"
)

PROSE_COMMENT = "<!-- Campos antigos de identificação -->"

SAMPLE_BODY = "\n".join(
    [
        PROSE_COMMENT,
        field_xml("contributor", "Autor"),
        MULTILINE_COMMENTED_FIELD,
        field_xml("title", "Título"),
        ONE_LINE_COMMENTED_FIELD,
        TWO_FIELDS_IN_ONE_COMMENT,
    ]
)

SAMPLE_XML = input_forms_xml(page_xml(1, SAMPLE_BODY))

# Mesmo arquivo, sem nenhum campo comentado (o comentário em prosa continua)
SAMPLE_WITHOUT_COMMENTED_FIELDS_XML = input_forms_xml(
    page_xml(1, "\n".join([PROSE_COMMENT, field_xml("contributor", "Autor"), field_xml("title", "Título")]))
)


def convert(xml_text: str, keep_commented_fields=None) -> tuple:
    """Executa a conversão real e devolve (xml de saída, estatísticas)"""
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "input-forms.xml"
        destination = Path(tmp) / "submission-forms.xml"
        source.write_text(xml_text, encoding="utf-8")

        kwargs = {} if keep_commented_fields is None else {"keep_commented_fields": keep_commented_fields}
        converter = InputFormsToSubmissionFormsConverter(**kwargs)
        stats = converter.convert(source, destination)
        return destination.read_text(encoding="utf-8"), stats


def parse_output(output_xml: str) -> ET.Element:
    """Interpreta a saída mantendo os comentários (o parser padrão os descarta)"""
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
    parser.feed(output_xml.split("\n", 2)[2])
    return parser.close()


def form_children(output_xml: str) -> list:
    return list(parse_output(output_xml).find("form-definitions").find("form"))


def comment_texts(output_xml: str) -> list:
    return [element.text for element in parse_output(output_xml).iter() if element.tag is ET.Comment]


class KeepCommentedFieldsTest(unittest.TestCase):
    def test_keep_preserves_commented_field_content(self):
        output, stats = convert(SAMPLE_XML, keep_commented_fields=True)

        self.assertEqual(stats["commented_fields_kept"], 4)
        self.assertTrue(any("<dc-element>identifier</dc-element>" in text for text in comment_texts(output)))
        self.assertIn("<dc-element>subject</dc-element>", output)
        self.assertIn("<dc-element>description</dc-element>", output)
        self.assertIn("<dc-element>format</dc-element>", output)

    def test_drop_removes_commented_field_content(self):
        output, stats = convert(SAMPLE_XML, keep_commented_fields=False)

        self.assertEqual(stats["commented_fields_kept"], 0)
        for hidden in ("identifier", "subject", "description", "format", "Campos antigos"):
            self.assertNotIn(hidden, output)

    def test_default_is_keep(self):
        output, stats = convert(SAMPLE_XML)

        self.assertEqual(stats["commented_fields_kept"], 4)
        self.assertIn("<dc-element>identifier</dc-element>", output)

    def test_commented_fields_keep_their_position_between_active_rows(self):
        output, _ = convert(SAMPLE_XML, keep_commented_fields=True)

        children = [
            "comment" if child.tag is ET.Comment else child.tag
            for child in form_children(output)
        ]
        # page1, contributor, identifier, title, subject, description+format
        self.assertEqual(children, ["comment", "row", "comment", "row", "comment", "comment"])

    def test_each_commented_field_appears_once(self):
        output, _ = convert(SAMPLE_XML, keep_commented_fields=True)

        # 2 campos ativos + 4 campos comentados
        self.assertEqual(output.count("<dc-element>"), 6)

    def test_commented_field_inside_comment_with_prose_is_preserved(self):
        xml_text = input_forms_xml(
            page_xml(1, f"<!-- campo antigo: {field_xml('relation', 'Relação')} -->\n{field_xml('title', 'Título')}")
        )

        output, stats = convert(xml_text, keep_commented_fields=True)

        self.assertEqual(stats["commented_fields_kept"], 1)
        self.assertTrue(any("<dc-element>relation</dc-element>" in text for text in comment_texts(output)))

    def test_commented_page_is_preserved_at_form_level(self):
        commented_page = (
            "<!--"
            + page_xml(2, field_xml("rights", "Direitos"))
            + "-->"
        )
        xml_text = input_forms_xml(page_xml(1, field_xml("title", "Título")) + "\n" + commented_page)

        output, stats = convert(xml_text, keep_commented_fields=True)

        self.assertEqual(stats["commented_fields_kept"], 1)
        self.assertTrue(any("<dc-element>rights</dc-element>" in text for text in comment_texts(output)))

    def test_malformed_commented_field_is_not_preserved(self):
        malformed = "<!-- <field><label>A&nbsp;B</label></field> -->"
        xml_text = input_forms_xml(page_xml(1, f"{malformed}\n{field_xml('title', 'Título')}"))

        output, stats = convert(xml_text, keep_commented_fields=True)

        self.assertEqual(stats["commented_fields_kept"], 0)
        ET.fromstring(output.split("\n", 2)[2])


class ActiveContentTest(unittest.TestCase):
    def test_active_field_text_around_inline_comment_is_unchanged(self):
        xml_text = input_forms_xml(
            page_xml(
                1,
                '<field><dc-element>title</dc-element><label>Título</label>'
                "<input-type>onebox</input-type>"
                "<hint>Digite o título<!-- nota interna --> do trabalho</hint>"
                "<required></required></field>",
            )
        )

        for keep in (True, False):
            with self.subTest(keep_commented_fields=keep):
                output, _ = convert(xml_text, keep_commented_fields=keep)
                self.assertIn("<hint>Digite o título do trabalho</hint>", output)

    def test_ordinary_comments_are_not_preserved(self):
        for keep in (True, False):
            with self.subTest(keep_commented_fields=keep):
                output, _ = convert(SAMPLE_XML, keep_commented_fields=keep)
                self.assertNotIn("Campos antigos de identificação", output)


class CompatibilityTest(unittest.TestCase):
    def test_drop_matches_file_without_commented_fields(self):
        """Remover os campos comentados gera o mesmo resultado de um arquivo sem eles"""
        dropped, _ = convert(SAMPLE_XML, keep_commented_fields=False)
        without_fields, _ = convert(SAMPLE_WITHOUT_COMMENTED_FIELDS_XML, keep_commented_fields=True)

        self.assertEqual(dropped, without_fields)

    def test_file_without_commented_fields_is_not_affected_by_option(self):
        keep, _ = convert(SAMPLE_WITHOUT_COMMENTED_FIELDS_XML, keep_commented_fields=True)
        drop, _ = convert(SAMPLE_WITHOUT_COMMENTED_FIELDS_XML, keep_commented_fields=False)

        self.assertEqual(keep, drop)


class OrchestratorTest(unittest.TestCase):
    def run_orchestrator(self, keep_commented_fields=None) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input-forms.xml"
            output_dir = Path(tmp) / "out"
            source.write_text(SAMPLE_XML, encoding="utf-8")

            kwargs = {} if keep_commented_fields is None else {"keep_commented_fields": keep_commented_fields}
            orchestrator = DSpaceConverterOrchestrator(
                input_forms_path=source, output_dir=output_dir, verbose=False, **kwargs
            )
            self.assertTrue(orchestrator.convert())
            self.assertTrue((output_dir / "item-submission.xml").exists())
            return (output_dir / "submission-forms.xml").read_text(encoding="utf-8")

    def test_orchestrator_keeps_by_default(self):
        self.assertIn("<dc-element>identifier</dc-element>", self.run_orchestrator())

    def test_orchestrator_removes_when_disabled(self):
        self.assertNotIn("identifier", self.run_orchestrator(keep_commented_fields=False))


class CommandLineTest(unittest.TestCase):
    def test_keep_is_default(self):
        args = main.parse_args([])

        self.assertTrue(args.keep_commented_fields)

    def test_flags_switch_the_option(self):
        self.assertTrue(main.parse_args(["--keep-commented-fields"]).keep_commented_fields)
        self.assertFalse(main.parse_args(["--no-keep-commented-fields"]).keep_commented_fields)

    def test_positional_arguments_still_work(self):
        args = main.parse_args(["in/input-forms.xml", "out", "--no-keep-commented-fields"])

        self.assertEqual(args.input_forms, "in/input-forms.xml")
        self.assertEqual(args.output_dir, "out")
        self.assertFalse(args.keep_commented_fields)


if __name__ == "__main__":
    unittest.main()
