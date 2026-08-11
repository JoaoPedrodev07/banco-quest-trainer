"""Paginação da API de conteúdo.

O acervo é lido inteiro pelo frontend — o simulado sorteia, filtra e ordena do
lado do cliente, então ele precisa mesmo de todas as questões do concurso. Isso
não é motivo para servir tudo numa resposta só: a diferença entre "o cliente
busca 5 páginas" e "o servidor monta 1,6 MB de uma vez" é o que separa uma API
que aguenta uma rajada de uma que cai com ela.

Por isso o tamanho de página é ajustável (`?page_size=`) mas **com teto**. Sem o
teto, `?page_size=999999` reconstrói exatamente o problema que a paginação veio
resolver, e de graça para quem pede.
"""

from rest_framework.pagination import PageNumberPagination


class PaginacaoPadrao(PageNumberPagination):
    page_size = 200
    page_size_query_param = "page_size"
    # Teto por página. 500 cabe o maior recorte de concurso que existe hoje (607
    # questões do BB vêm em 2 páginas) sem permitir que alguém peça o banco todo.
    max_page_size = 500
